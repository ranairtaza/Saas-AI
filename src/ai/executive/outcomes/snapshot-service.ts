import { prisma } from '../../../lib/db';
import { TelemetrySnapshot, GoalSnapshotItem } from './types';
import { BusinessContextBuilder } from '../context-builder';
import { BusinessHealthEvaluator } from '../health-evaluator';
import { GoalTracker } from '../goal-tracker';

export class TelemetrySnapshotService {
  /**
   * Captures an authoritative, immutable TelemetrySnapshot for an organization.
   */
  static async captureSnapshot(organizationId: string): Promise<TelemetrySnapshot> {
    // 1. Build unified business context to get grounded telemetry and goals
    const context = await BusinessContextBuilder.buildBusinessContext(organizationId);

    // 2. Compute current business health deterministically
    const health = BusinessHealthEvaluator.evaluateHealth(context);

    // 3. Map goal statuses
    const goalStatuses: GoalSnapshotItem[] = context.goals.map((g) => {
      const evaluated = GoalTracker.evaluateGoal({
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        startDate: new Date(g.startDate),
        endDate: new Date(g.endDate),
      });

      return {
        goalId: g.id || '',
        kpiKey: g.kpiKey,
        currentValue: g.currentValue,
        targetValue: g.targetValue,
        progressPct: evaluated.progressPct,
        status: evaluated.status,
      };
    });

    return {
      timestamp: new Date().toISOString(),
      revenueMTD: context.telemetry.metrics.revenueMTD?.value ?? null,
      pipelineValue: context.telemetry.metrics.pipelineValue?.value ?? null,
      activeLeadsCount: context.telemetry.metrics.activeLeadsCount?.value ?? null,
      qualifiedLeadsCount: context.telemetry.metrics.qualifiedLeads?.value ?? null,
      unassignedHighPriorityLeads: context.telemetry.metrics.unassignedHighPriorityLeads?.value ?? null,
      businessHealthScore: health.overallScore,
      domainHealthScores: {
        revenue: health.domains.revenue.score,
        pipeline: health.domains.pipeline.score,
        goals: health.domains.goals.score,
        operations: health.domains.operations.score,
      },
      goalStatuses,
    };
  }

  /**
   * Deterministically extracts the numerical target value from a snapshot for a given KPI key.
   */
  static extractMetricValue(
    snapshot: TelemetrySnapshot,
    kpiKey?: string | null,
    targetGoalId?: string | null
  ): number | null {
    if (!kpiKey) return null;

    const key = kpiKey.toLowerCase();

    // Check specific goal KPI first if targetGoalId is specified
    if (targetGoalId && snapshot.goalStatuses.length > 0) {
      const matchedGoal = snapshot.goalStatuses.find((g) => g.goalId === targetGoalId);
      if (matchedGoal) {
        return matchedGoal.currentValue;
      }
    }

    // Match standardized telemetry dimensions
    if (key === 'unassigned_leads' || key === 'unassigned_high_priority_leads' || key === 'unassigned') {
      return snapshot.unassignedHighPriorityLeads;
    }
    if (key === 'revenue' || key === 'revenue_mtd' || key === 'revenue_mrr' || key === 'mrr') {
      return snapshot.revenueMTD;
    }
    if (key === 'pipeline' || key === 'pipeline_value') {
      return snapshot.pipelineValue;
    }
    if (key === 'qualified_leads' || key === 'qualified_leads_count') {
      return snapshot.qualifiedLeadsCount;
    }
    if (key === 'active_leads' || key === 'active_leads_count' || key === 'total_leads') {
      return snapshot.activeLeadsCount;
    }
    if (key === 'health_score' || key === 'business_health') {
      return snapshot.businessHealthScore;
    }

    // Check goal matches by kpiKey
    const goalMatch = snapshot.goalStatuses.find((g) => g.kpiKey.toLowerCase() === key);
    if (goalMatch) {
      return goalMatch.currentValue;
    }

    // No matching metric found in snapshot — return null (zero fabrication)
    return null;
  }
}
