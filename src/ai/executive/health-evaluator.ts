import { BusinessContext } from './types';
import { BusinessHealth, BusinessHealthSchema, DomainHealth } from './events/types';

export class BusinessHealthEvaluator {
  /**
   * 100% deterministic calculation of organizational business health (0-100)
   */
  static evaluateHealth(
    context: BusinessContext,
    options?: { activeEventCount?: number; criticalEventCount?: number }
  ): BusinessHealth {
    // 1. REVENUE HEALTH (Weight: 0.35)
    const revenueHealth = this.calculateRevenueHealth(context);

    // 2. PIPELINE HEALTH (Weight: 0.25)
    const pipelineHealth = this.calculatePipelineHealth(context);

    // 3. GOAL HEALTH (Weight: 0.25)
    const goalHealth = this.calculateGoalHealth(context);

    // 4. OPERATIONAL HEALTH (Weight: 0.15)
    const operationsHealth = this.calculateOperationalHealth(context, options);

    // Composite Weighted Score
    const compositeRaw =
      revenueHealth.score * 0.35 +
      pipelineHealth.score * 0.25 +
      goalHealth.score * 0.25 +
      operationsHealth.score * 0.15;

    const overallScore = Math.min(100, Math.max(0, Math.round(compositeRaw)));
    const status = this.getHealthStatus(overallScore);

    const summary = this.generateSummary(overallScore, status, {
      revenue: revenueHealth,
      pipeline: pipelineHealth,
      goals: goalHealth,
      operations: operationsHealth,
    });

    return BusinessHealthSchema.parse({
      overallScore,
      status,
      evaluatedAt: new Date(),
      domains: {
        revenue: revenueHealth,
        pipeline: pipelineHealth,
        goals: goalHealth,
        operations: operationsHealth,
      },
      summary,
    });
  }

  private static calculateRevenueHealth(context: BusinessContext): DomainHealth {
    const revGoal = context.goals.find(
      (g) => g.kpiKey.toLowerCase().includes('revenue') || g.kpiKey.toLowerCase().includes('mrr')
    );

    let score = 80;
    const factors: string[] = [];

    if (revGoal) {
      if (revGoal.status === 'ACHIEVED') {
        score = 100;
        factors.push(`Revenue milestone achieved (${revGoal.progressPct}% of target)`);
      } else if (revGoal.status === 'ON_TRACK') {
        score = Math.min(95, 75 + Math.round((revGoal.progressPct || 0) * 0.2));
        factors.push(`Revenue pacing is on track (${revGoal.progressPct}%)`);
      } else if (revGoal.status === 'AT_RISK') {
        score = Math.max(45, 60 - Math.round(((revGoal.timeElapsedPct || 0) - (revGoal.progressPct || 0)) * 0.5));
        factors.push(`Revenue milestone is at risk (Gap: $${revGoal.gapValue?.toLocaleString() || 0})`);
      } else if (revGoal.status === 'BEHIND') {
        score = Math.max(20, 35 - Math.round(((revGoal.timeElapsedPct || 0) - (revGoal.progressPct || 0)) * 0.3));
        factors.push(`Revenue milestone is significantly behind pace`);
      }
    } else {
      score = (typeof ((context.telemetry.metrics.revenueMTD?.value || 0) || 0) === 'number' && ((context.telemetry.metrics.revenueMTD?.value || 0) || 0) > 0) ? 80 : 60;
      factors.push(`Baseline MTD revenue recorded: $${(((context.telemetry.metrics.revenueMTD?.value || 0) || 0) || 0).toLocaleString()}`);
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      status: this.getHealthStatus(score),
      weight: 0.35,
      rationale: `Revenue health evaluated at ${score}/100 based on active target pacing.`,
      factors,
    };
  }

  private static calculatePipelineHealth(context: BusinessContext): DomainHealth {
    let score = 85;
    const factors: string[] = [];

    // Qualified leads bonus
    if ((typeof (context.telemetry.metrics.qualifiedLeads?.value || 0) === 'number' && (context.telemetry.metrics.qualifiedLeads?.value || 0) > 5)) {
      score += 5;
      factors.push(`Healthy volume of ${(context.telemetry.metrics.qualifiedLeads?.value || 0)} qualified leads`);
    }

    // Unassigned backlog penalty
    const unassigned = (context.telemetry.metrics.unassignedHighPriorityLeads?.value || 0);
    if ((unassigned ?? 0) > 0) {
      const penalty = Math.min(50, (unassigned || 0) * 15);
      score -= penalty;
      factors.push(`${unassigned} unassigned high-priority lead backlog (-${penalty} pts)`);
    } else {
      factors.push('Zero unassigned priority lead backlog');
    }

    score = Math.min(100, Math.max(0, score));

    return {
      score,
      status: this.getHealthStatus(score),
      weight: 0.25,
      rationale: `Pipeline health evaluated at ${score}/100 based on volume and allocation efficiency.`,
      factors,
    };
  }

  private static calculateGoalHealth(context: BusinessContext): DomainHealth {
    if (context.goals.length === 0) {
      return {
        score: 75,
        status: 'STABLE',
        weight: 0.25,
        rationale: 'No active strategic goals configured.',
        factors: ['Default baseline applied (75/100)'],
      };
    }

    let totalScore = 0;
    const factors: string[] = [];

    for (const goal of context.goals) {
      let gScore = 70;
      if (goal.status === 'ACHIEVED') gScore = 100;
      else if (goal.status === 'ON_TRACK') gScore = 85;
      else if (goal.status === 'AT_RISK') gScore = 50;
      else if (goal.status === 'BEHIND') gScore = 25;

      totalScore += gScore;
      factors.push(`Goal "${goal.title}": ${goal.status} (${gScore} pts)`);
    }

    const avgScore = Math.min(100, Math.max(0, Math.round(totalScore / context.goals.length)));

    return {
      score: avgScore,
      status: this.getHealthStatus(avgScore),
      weight: 0.25,
      rationale: `Average strategic goal progress across ${context.goals.length} active target(s).`,
      factors,
    };
  }

  private static calculateOperationalHealth(
    context: BusinessContext,
    options?: { activeEventCount?: number; criticalEventCount?: number }
  ): DomainHealth {
    let score = 95;
    const factors: string[] = [];

    const criticalCount = options?.criticalEventCount || 0;
    const totalEvents = options?.activeEventCount || 0;

    if (criticalCount > 0) {
      const penalty = Math.min(60, criticalCount * 25);
      score -= penalty;
      factors.push(`${criticalCount} critical operational event(s) active (-${penalty} pts)`);
    } else if (totalEvents > 0) {
      const penalty = Math.min(20, totalEvents * 5);
      score -= penalty;
      factors.push(`${totalEvents} active business events in monitoring (-${penalty} pts)`);
    } else {
      factors.push('All operational indicators nominal with zero critical events');
    }

    score = Math.min(100, Math.max(0, score));

    return {
      score,
      status: this.getHealthStatus(score),
      weight: 0.15,
      rationale: `Operational stability evaluated at ${score}/100.`,
      factors,
    };
  }

  private static getHealthStatus(score: number): 'HEALTHY' | 'STABLE' | 'ATTENTION_NEEDED' | 'CRITICAL_RISK' {
    if (score >= 85) return 'HEALTHY';
    if (score >= 65) return 'STABLE';
    if (score >= 45) return 'ATTENTION_NEEDED';
    return 'CRITICAL_RISK';
  }

  private static generateSummary(
    overallScore: number,
    status: string,
    domains: { revenue: DomainHealth; pipeline: DomainHealth; goals: DomainHealth; operations: DomainHealth }
  ): string {
    if (status === 'HEALTHY') {
      return `Overall business health is strong at ${overallScore}/100. Revenue pacing and pipeline allocation are operating within optimal parameters.`;
    }
    if (status === 'STABLE') {
      return `Overall business health is stable at ${overallScore}/100. Core operations are functioning with minor optimization opportunities in ${domains.pipeline.score < domains.revenue.score ? 'pipeline routing' : 'revenue pacing'}.`;
    }
    if (status === 'ATTENTION_NEEDED') {
      return `Business health requires attention (${overallScore}/100). Key risks identified in ${domains.revenue.score < 60 ? 'revenue milestone pacing' : 'lead distribution backlogs'}.`;
    }
    return `Critical business risks detected (${overallScore}/100). Immediate executive intervention required across lagging milestones and unallocated high-value assets.`;
  }
}
