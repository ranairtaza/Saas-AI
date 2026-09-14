import { PrismaClient } from '@prisma/client';
import { AttributionLevel, OutcomeConfidence } from './types';

export class AttributionEngine {
  /**
   * Deterministically calculates the outcome attribution based on execution provenance.
   * Do NOT use LLMs for this.
   */
  static async evaluateCausality(params: {
    prisma: PrismaClient;
    outcomeId: string;
    organizationId: string;
    decisionId?: string | null;
    actionPlanId?: string | null;
    pendingActionId?: string | null;
    actionName?: string | null;
    targetKpiKey?: string | null;
    baselineValue: number | null;
    finalValue: number | null;
    deltaValue: number | null;
    deltaPercentage: number | null;
    expectedImpactValue?: number | null;
    confoundingFactors?: any[];
  }): Promise<{ level: AttributionLevel; rationale: string; confidence: OutcomeConfidence }> {
    const actionName = (params.actionName || '').toLowerCase();
    const kpi = (params.targetKpiKey || '').toLowerCase();
    const hasConfounding = Array.isArray(params.confoundingFactors) && params.confoundingFactors.length > 0;

    // 1. Missing baseline check (simulated if deltaValue is NaN or undefined, though typed as number)
    if (params.baselineValue === undefined || params.baselineValue === null || Number.isNaN(params.baselineValue) || params.deltaValue === null) {
      return {
        level: 'INCONCLUSIVE',
        rationale: 'Missing baseline or final value makes it impossible to measure actual outcome.',
        confidence: 'INSUFFICIENT'
      };
    }

    // 2. We MUST have a pendingActionId to even begin attributing causally to an action.
    if (!params.pendingActionId) {
      return {
        level: 'INSUFFICIENT_EVIDENCE',
        rationale: 'No specific action execution trace (PendingAction) is associated with this outcome.',
        confidence: 'INSUFFICIENT'
      };
    }

    // 3. Verify the execution status and tenant isolation from the database.
    const pendingAction = await params.prisma.pendingAction.findUnique({
      where: { id: params.pendingActionId }
    }).catch(() => null);

    if (!pendingAction) {
      return {
        level: 'INSUFFICIENT_EVIDENCE',
        rationale: 'The execution record (PendingAction) could not be found or verified.',
        confidence: 'INSUFFICIENT'
      };
    }

    // Tenant isolation verification
    if (pendingAction.organizationId !== params.organizationId) {
      return {
        level: 'INSUFFICIENT_EVIDENCE',
        rationale: 'DENIED: Cross-tenant linkage attempted.',
        confidence: 'INSUFFICIENT'
      };
    }

    if (params.decisionId) {
      const decision = await params.prisma.executiveDecision.findUnique({ where: { id: params.decisionId } }).catch(() => null);
      if (!decision || decision.organizationId !== params.organizationId) {
        return {
          level: 'INSUFFICIENT_EVIDENCE',
          rationale: 'DENIED: Cross-tenant linkage attempted on Decision.',
          confidence: 'INSUFFICIENT'
        };
      }
    }

    if (params.actionPlanId) {
      const plan = await params.prisma.executiveActionPlan.findUnique({ where: { id: params.actionPlanId } }).catch(() => null);
      if (!plan || plan.organizationId !== params.organizationId) {
        return {
          level: 'INSUFFICIENT_EVIDENCE',
          rationale: 'DENIED: Cross-tenant linkage attempted on ActionPlan.',
          confidence: 'INSUFFICIENT'
        };
      }
    }

    // Must be actually executed
    if (pendingAction.status !== 'COMPLETED' && pendingAction.status !== 'EXECUTED') {
      return {
        level: 'INSUFFICIENT_EVIDENCE',
        rationale: `The action was not successfully completed (status: ${pendingAction.status}). A proposed or approved action is not sufficient.`,
        confidence: 'INSUFFICIENT'
      };
    }

    // 4. Check if there is any measurable outcome
    if (params.deltaValue === 0) {
      return {
        level: 'INCONCLUSIVE',
        rationale: 'Executed but no measurable outcome (delta is zero).',
        confidence: 'LOW'
      };
    }

    // 5. Check if the movement was favorable.
    const isLowerBetter = kpi.includes('unassigned') || kpi.includes('churn') || kpi.includes('backlog');
    let isFavorable = false;
    
    if (isLowerBetter) {
      isFavorable = params.deltaValue < 0;
    } else {
      isFavorable = params.deltaValue > 0;
    }

    if (!isFavorable) {
      return {
        level: 'NONE',
        rationale: 'No favorable metric movement observed following action execution.',
        confidence: 'HIGH'
      };
    }

    // Since the system currently evaluates aggregate KPIs rather than exact deterministic
    // transactional causal linkages, we cannot genuinely establish DIRECT_CAUSAL attribution.
    // As mandated, we must not manufacture one based on action type or metric name.

    // Correlated Causality for broader metrics
    if (hasConfounding) {
      return {
        level: 'INCONCLUSIVE',
        rationale: `Execution confirmed, but metric improvements have confounding factors, preventing even correlational certainty.`,
        confidence: 'LOW'
      };
    }

    return {
      level: 'CORRELATED',
      rationale: `Execution confirmed. Target KPI [${kpi}] improved following successful execution, but causal mechanism is not provable.`,
      confidence: 'MEDIUM'
    };
  }
}
