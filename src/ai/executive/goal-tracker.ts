import { prisma } from '../../lib/db';
import { assertDatabaseWritesAllowed } from '../../lib/db-guard';
import { BusinessGoalData, BusinessGoalStatus } from './types';
import { logAudit } from '../../audit/logger';

export class GoalTracker {
  /**
   * Deterministically calculates progress percentage (0-100%)
   */
  static calculateGoalProgress(targetValue: number, currentValue: number): number {
    if (targetValue <= 0) return currentValue >= 0 ? 100 : 0;
    const progress = (currentValue / targetValue) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  /**
   * Deterministically calculates absolute numerical gap
   */
  static calculateGoalGap(targetValue: number, currentValue: number): number {
    return Math.max(0, Number((targetValue - currentValue).toFixed(2)));
  }

  /**
   * Deterministically calculates elapsed time percentage (0-100%)
   */
  static calculateTimeElapsedPct(startDate: Date, endDate: Date, now: Date = new Date()): number {
    const start = startDate.getTime();
    const end = endDate.getTime();
    const current = now.getTime();

    if (end <= start) return 100;
    if (current <= start) return 0;
    if (current >= end) return 100;

    const elapsed = ((current - start) / (end - start)) * 100;
    return Math.min(100, Math.max(0, Math.round(elapsed)));
  }

  /**
   * Deterministically determines goal status based on progress vs time elapsed
   */
  static determineGoalStatus(
    targetValue: number,
    currentValue: number,
    startDate: Date,
    endDate: Date,
    currentStatus?: BusinessGoalStatus,
    now: Date = new Date()
  ): BusinessGoalStatus {
    if (currentStatus === 'DRAFT' || currentStatus === 'CANCELLED') {
      return currentStatus;
    }

    if (currentValue >= targetValue && targetValue > 0) {
      return 'ACHIEVED';
    }

    const timeElapsedPct = this.calculateTimeElapsedPct(startDate, endDate, now);
    const progressPct = this.calculateGoalProgress(targetValue, currentValue);

    if (timeElapsedPct >= 100 && currentValue < targetValue) {
      return 'BEHIND';
    }

    // Phase 50: Do not dynamically fallback to DRAFT.
    if (timeElapsedPct < 10) {
      return 'ON_TRACK';
    }

    // Ratio of progress achieved to time elapsed
    const pacingRatio = progressPct / timeElapsedPct;

    if (pacingRatio >= 0.85) {
      return 'ON_TRACK';
    } else if (pacingRatio >= 0.6) {
      return 'AT_RISK';
    } else {
      return 'BEHIND';
    }
  }

  /**
   * Evaluates a goal completely with progress, gap, time elapsed, and status
   */
  static evaluateGoal(
    goal: {
      targetValue: number;
      currentValue: number;
      startDate: Date;
      endDate: Date;
      status?: BusinessGoalStatus;
    },
    now: Date = new Date()
  ): {
    progressPct: number;
    gapValue: number;
    timeElapsedPct: number;
    status: BusinessGoalStatus;
  } {
    const progressPct = this.calculateGoalProgress(goal.targetValue, goal.currentValue);
    const gapValue = this.calculateGoalGap(goal.targetValue, goal.currentValue);
    const timeElapsedPct = this.calculateTimeElapsedPct(goal.startDate, goal.endDate, now);
    const status = this.determineGoalStatus(
      goal.targetValue,
      goal.currentValue,
      goal.startDate,
      goal.endDate,
      goal.status,
      now
    );

    return {
      progressPct,
      gapValue,
      timeElapsedPct,
      status,
    };
  }

  /**
   * Creates a new BusinessGoal
   */
  static async createGoal(
    organizationId: string,
    data: {
      title: string;
      kpiKey: string;
      targetValue: number;
      currentValue?: number;
      unit: string;
      startDate?: Date;
      endDate: Date;
      userId?: string;
    }
  ): Promise<BusinessGoalData> {
    assertDatabaseWritesAllowed('create business goal');

    const startDate = data.startDate || new Date();
    const currentValue = data.currentValue || 0;
    const { status, progressPct, gapValue, timeElapsedPct } = this.evaluateGoal({
      targetValue: data.targetValue,
      currentValue,
      startDate,
      endDate: data.endDate,
    });

    const created = await prisma.businessGoal.create({
      data: {
        organizationId,
        title: data.title,
        kpiKey: data.kpiKey,
        targetValue: data.targetValue,
        currentValue,
        unit: data.unit,
        startDate,
        endDate: data.endDate,
        status,
      },
    });

    if (data.userId) {
      await logAudit({
        organizationId,
        userId: data.userId,
        action: 'EXECUTIVE_GOAL_CREATED' as any,
        resource: `businessGoal:${created.id}`,
        status: 'SUCCESS',
        details: { title: data.title, targetValue: data.targetValue, kpiKey: data.kpiKey },
      });
    }

    return {
      id: created.id,
      organizationId: created.organizationId,
      title: created.title,
      kpiKey: created.kpiKey,
      targetValue: created.targetValue,
      currentValue: created.currentValue,
      unit: created.unit,
      startDate: created.startDate,
      endDate: created.endDate,
      status: created.status as BusinessGoalStatus,
      progressPct,
      gapValue,
      timeElapsedPct,
      source: created.source as any,
      period: created.period as any,
    };
  }

  /**
   * Retrieves active goals for an organization with up-to-date evaluated metrics
   */
  static async getActiveGoals(organizationId: string): Promise<BusinessGoalData[]> {
    const goals = await prisma.businessGoal.findMany({
      where: { organizationId },
      orderBy: { endDate: 'asc' },
    });

    return goals.map((g) => {
      const evalResult = this.evaluateGoal({
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        startDate: g.startDate,
        endDate: g.endDate,
        status: g.status as BusinessGoalStatus,
      });

      return {
        id: g.id,
        organizationId: g.organizationId,
        title: g.title,
        kpiKey: g.kpiKey,
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        unit: g.unit,
        startDate: g.startDate,
        endDate: g.endDate,
        status: evalResult.status,
        progressPct: evalResult.progressPct,
        gapValue: evalResult.gapValue,
        timeElapsedPct: evalResult.timeElapsedPct,
        source: g.source as any,
        period: g.period as any,
      };
    });
  }

  /**
   * Updates a goal's current value and recalculates status deterministically
   */
  static async updateGoalProgress(
    organizationId: string,
    goalId: string,
    currentValue: number,
    userId?: string
  ): Promise<BusinessGoalData> {
    assertDatabaseWritesAllowed('update goal progress');

    const existing = await prisma.businessGoal.findUnique({
      where: { id: goalId, organizationId },
    });

    if (!existing) {
      throw new Error(`Goal ${goalId} not found in organization ${organizationId}`);
    }

    const { status, progressPct, gapValue, timeElapsedPct } = this.evaluateGoal({
      targetValue: existing.targetValue,
      currentValue,
      startDate: existing.startDate,
      endDate: existing.endDate,
      status: existing.status as BusinessGoalStatus,
    });

    const updated = await prisma.businessGoal.update({
      where: { id: goalId },
      data: {
        currentValue,
        status,
      },
    });

    if (userId) {
      await logAudit({
        organizationId,
        userId,
        action: 'EXECUTIVE_GOAL_UPDATED' as any,
        resource: `businessGoal:${goalId}`,
        status: 'SUCCESS',
        details: { currentValue, status, progressPct },
      });
    }

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      title: updated.title,
      kpiKey: updated.kpiKey,
      targetValue: updated.targetValue,
      currentValue: updated.currentValue,
      unit: updated.unit,
      startDate: updated.startDate,
      endDate: updated.endDate,
      status: updated.status as BusinessGoalStatus,
      progressPct,
      gapValue,
      timeElapsedPct,
      source: updated.source as any,
      period: updated.period as any,
    };
  }
}
