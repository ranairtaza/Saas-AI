import { prisma } from '../../lib/db';
import { BusinessContext, BusinessContextSchema } from './types';
import { GoalTracker } from './goal-tracker';
import { ExecutiveMemoryService } from './memory-service';
import { calculateFreshness } from '../../lib/integrations/health';

import { BusinessIntelligenceEngine } from './bi-engine';
import { ExecutiveForecastingService } from './forecasting/forecasting-service';
import { ExecutiveStrategyService } from './strategy/strategy-service';
import { OutcomeEvaluator } from './outcomes/evaluator';

export class BusinessContextBuilder {
  /**
   * Assembles a unified, authoritative BusinessContext snapshot for an organization
   */
  static async buildBusinessContext(organizationId: string): Promise<BusinessContext> {
    // 1. Identity
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { BusinessProfile: true },
    });

    if (!org) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    const profile = org.BusinessProfile;
    const identity = {
      name: profile?.businessName || org.name || 'Organization',
      industry: profile?.industry || org.industry || 'B2B Software',
      businessModel: profile?.businessModel || 'B2B SaaS',
      targetMarket: profile?.targetMarket || 'Enterprise & Mid-Market',
      operatingPriorities: profile?.operatingPriorities || 'Revenue Growth',
      operatingCurrency: profile?.currency || 'USD',
      timezone: profile?.timezone || org.timezone || 'UTC',
    };

    // 2. Unified Telemetry & Multi-Source Intelligence
    // dataFreshness = await Promise.all integration connections with calculateFreshness(lastSuccessfulSyncAt)
    const unifiedTelemetry = await BusinessIntelligenceEngine.assembleTelemetry(organizationId);

    // 3. Goals
    const rawGoals = await prisma.businessGoal.findMany({
      where: { organizationId },
      orderBy: { endDate: 'asc' },
      take: 10,
    });

    const goals = rawGoals.map((g) => {
      const evalResult = GoalTracker.evaluateGoal({
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        startDate: g.startDate,
        endDate: g.endDate,
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
        source: g.source as any,
        period: g.period as any,
        progressPct: evalResult.progressPct,
        gapValue: evalResult.gapValue,
        timeElapsedPct: evalResult.timeElapsedPct,
      };
    });

    // 4. Bounded Executive Memory (Top 5 recent)
    const recentMemories = await ExecutiveMemoryService.getMemories(organizationId, { limit: 5 });

    // 5. Operating Governance Policies
    const policies = [
      {
        rule: 'High-risk operations (record deletion, status override, financial adjustments) require human approval.',
        riskLevel: 'HIGH' as const,
      },
      {
        rule: 'High-value Enterprise leads (score >= 75) must be assigned within 24 hours of discovery.',
        riskLevel: 'MEDIUM' as const,
      },
      {
        rule: 'AI Executive recommendations must be strictly grounded in verified database facts.',
        riskLevel: 'CRITICAL' as const,
      },
    ];

    // 6. Untrusted External Data Sampling (sanitized lead notes / descriptions)
    const sampleLeads = await prisma.lead.findMany({
      where: { organizationId },
      select: { companyName: true, notes: true },
      take: 3,
    });

    const untrustedExternalData = sampleLeads
      .filter((l) => Boolean(l.notes))
      .map((l) => `[Lead: ${l.companyName}] ${l.notes}`);

    // 7. Historical Decision Intelligence (Phase 25)
    let historicalPerformance: any = undefined;
    try {
      const measuredOutcomes = await prisma.executiveOutcome.findMany({
        where: { organizationId, status: 'MEASURED' },
        include: { recommendation: true },
        take: 20,
      });

      if (measuredOutcomes.length > 0) {
        const totalRecommendations = await prisma.executiveRecommendation.count({
          where: { organizationId },
        });
        const totalExecuted = await prisma.executiveRecommendation.count({
          where: { organizationId, status: { in: ['PROPOSED', 'APPROVED'] } },
        });

        let successCount = 0;
        let partialCount = 0;
        const validatedStrategies: string[] = [];
        const refutedHypotheses: string[] = [];
        const domainStats: Record<string, any> = {};

        for (const o of measuredOutcomes) {
          const dom = o.domain || 'REVENUE';
          if (!domainStats[dom]) {
            domainStats[dom] = { total: 0, successful: 0, winRatePct: 0 };
          }
          domainStats[dom].total += 1;

          if (o.resultStatus === 'SUCCESS') {
            successCount += 1;
            domainStats[dom].successful += 1;
            if (o.recommendation?.title && !validatedStrategies.includes(o.recommendation.title)) {
              validatedStrategies.push(o.recommendation.title);
            }
          } else if (o.resultStatus === 'PARTIAL') {
            partialCount += 1;
          }

          if (o.hypothesisStatus === 'REFUTED' && o.recommendation?.title) {
            if (!refutedHypotheses.includes(o.recommendation.title)) {
              refutedHypotheses.push(o.recommendation.title);
            }
          }
        }

        for (const dom of Object.keys(domainStats)) {
          domainStats[dom].winRatePct = Math.round(
            (domainStats[dom].successful / domainStats[dom].total) * 100
          );
        }

        const successRatePct = Math.round(
          ((successCount + 0.5 * partialCount) / measuredOutcomes.length) * 100
        );

        const effectivenessScore = OutcomeEvaluator.calculateEffectivenessScore({
          totalRecommendations,
          totalExecuted,
          successCount,
          partialCount,
          totalMeasured: measuredOutcomes.length,
          avgHealthScoreDelta: 0,
          supportedCount: measuredOutcomes.filter((o) => o.hypothesisStatus === 'SUPPORTED').length,
          refutedCount: refutedHypotheses.length,
        });

        historicalPerformance = {
          totalRecommendations,
          totalExecuted,
          totalMeasured: measuredOutcomes.length,
          successRatePct,
          effectivenessScore,
          domainPerformance: domainStats,
          topValidatedStrategies: validatedStrategies.slice(0, 3),
          refutedHypotheses: refutedHypotheses.slice(0, 3),
        };
      }
    } catch (err) {
      // Non-blocking fallback
    }

    // 8. Phase 41: Predictive Business Intelligence & Outlook
    let predictiveOutlook = undefined;
    try {
      predictiveOutlook = await ExecutiveForecastingService.getPredictiveOutlook(organizationId);
    } catch (err) {
      // Non-blocking fallback
    }

    // 9. Phase 42: Planning & Target Gap Engine
    let planning: any = undefined;
    try {
      const { PlanningEngine } = await import('./planning/planning-engine');
      const planningGoals = await PlanningEngine.evaluateGoals(organizationId);
      planning = {
        goals: planningGoals,
        priorities: [],
      };
    } catch (err) {
      // Non-blocking fallback
      console.error('Failed to load planning engine', err);
    }

    // 10. Phase 43: Executive Strategy & Priority Layer
    let strategy: any = undefined;
    try {
      strategy = ExecutiveStrategyService.synthesizeStrategy({
        goals: planning?.goals || goals,
        outlooks: predictiveOutlook?.forecasts || {},
        metrics: unifiedTelemetry.metrics || {},
        anomalies: predictiveOutlook?.anomalies || {},
      });
    } catch (err) {
      console.error('Failed to load strategy engine', err);
    }

    // 11. Phase 44: Executive Execution Planning
    let executionPlanning: any = undefined;
    try {
      if (strategy) {
        const { ExecutiveExecutionService } = await import('./execution/execution-service');
        const initiatives = ExecutiveExecutionService.planExecution({
          organizationId,
          strategy,
        });
        executionPlanning = { initiatives };
      }
    } catch (err) {
      console.error('Failed to load execution planning engine', err);
    }

    const context: BusinessContext = {
      organizationId,
      identity,
      telemetry: unifiedTelemetry,
      goals,
      planning,
      recentMemories,
      policies,
      historicalPerformance,
      untrustedExternalData,
      predictiveOutlook,
      strategy,
      executionPlanning,
      assembledAt: new Date(),
    };

    // Strictly validate against Zod schema
    return BusinessContextSchema.parse(context);
  }
}
