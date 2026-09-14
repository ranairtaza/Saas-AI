import { ExecutiveOperatingState } from './operating-state/types';
import {
  ExecutiveAttentionItem,
  ExecutiveAttentionItemSchema,
  EvidenceSufficiency,
} from './executive-value-types';

/**
 * Executive Attention Model
 * 
 * Deterministic attention ranker that synthesizes operating state into
 * a ranked list of items requiring executive review.
 * 
 * Pure computation: does not approve, execute, or trigger external side effects.
 */
export class ExecutiveAttentionModel {

  /**
   * Build ranked attention items from operating state.
   * Items are sorted by: severity → priority → governance urgency.
   */
  static buildAttentionItems(state: ExecutiveOperatingState): ExecutiveAttentionItem[] {
    const items: ExecutiveAttentionItem[] = [];

    // 1. Surface governance-BLOCKED decisions (always require attention)
    for (const decision of state.activeDecisions) {
      if (decision.governanceVerdict === 'BLOCKED' || decision.status === 'PENDING') {
        const isBlocked = decision.governanceVerdict === 'BLOCKED';
        const severity = this.mapPriorityToSeverity(decision.priority);
        const priority = this.normalizePriority(decision.priority);

        items.push(ExecutiveAttentionItemSchema.parse({
          id: `attn-decision-${decision.id}`,
          title: decision.title,
          domain: decision.domain,
          severity,
          priority,
          whyNow: isBlocked
            ? `Decision "${decision.title}" is BLOCKED by governance policy and requires executive review to proceed or dismiss.`
            : `Decision "${decision.title}" is pending and awaiting executive action.`,
          businessImpact: `${decision.decisionType} decision in ${decision.domain} domain requires resolution.`,
          evidence: [
            `Decision status: ${decision.status}`,
            `Governance verdict: ${decision.governanceVerdict}`,
            `Priority: ${decision.priority}`,
          ],
          sourceIds: [decision.id],
          currentState: `${decision.status} (${decision.governanceVerdict})`,
          forecastState: undefined,
          risk: isBlocked
            ? 'Governance-blocked decisions cannot proceed and may create operational delay.'
            : 'Pending decision may delay dependent actions.',
          confidence: 'HIGH' as const,
          governanceVerdict: decision.governanceVerdict,
          requiredAuthority: undefined,
          relatedDecisionId: decision.id,
          relatedActionPlanId: undefined,
          consequenceOfInaction: isBlocked
            ? `The ${decision.domain} decision "${decision.title}" will remain blocked indefinitely without executive intervention.`
            : `Decision "${decision.title}" will remain pending and delay any dependent operations.`,
          recommendedReview: isBlocked
            ? 'Review governance policy constraints and determine whether to escalate, override with justification, or cancel.'
            : 'Review the decision context and approve, reject, or defer.',
          evidenceSufficiency: 'SUFFICIENT' as EvidenceSufficiency,
        }));
      }
    }

    // 2. Surface action plans requiring approval
    for (const plan of state.actionPlans) {
      if (plan.status === 'PROPOSED' || plan.status === 'PENDING_APPROVAL' || plan.status === 'GOVERNANCE_REVIEW') {
        const isBlocked = plan.governanceVerdict === 'BLOCKED';
        const severity = this.mapPriorityToSeverity(plan.priority);
        const priority = this.normalizePriority(plan.priority);

        const forecastMatch = state.activeForecasts.find(f => f.domain === plan.domain);

        items.push(ExecutiveAttentionItemSchema.parse({
          id: `attn-action-${plan.id}`,
          title: plan.title,
          domain: plan.domain,
          severity,
          priority,
          whyNow: isBlocked
            ? `Action plan "${plan.title}" is BLOCKED by governance and cannot be approved until policy constraints are resolved.`
            : `Action plan "${plan.title}" is awaiting executive review and approval.`,
          businessImpact: plan.expectedImpact || `${plan.actionType} action in ${plan.domain} domain.`,
          evidence: [
            `Action type: ${plan.actionType}`,
            `Status: ${plan.status}`,
            `Governance: ${plan.governanceVerdict}`,
            `Confidence: ${plan.confidence}`,
            `Priority: ${plan.priority}`,
          ],
          sourceIds: [plan.id],
          currentState: `${plan.status} (${plan.governanceVerdict})`,
          forecastState: forecastMatch ? `${forecastMatch.metric}: ${forecastMatch.direction} (${forecastMatch.confidence} confidence)` : undefined,
          risk: isBlocked
            ? 'Governance block prevents action execution; opportunity window may close.'
            : 'Delay in approval may reduce expected impact.',
          confidence: this.normalizeConfidence(plan.confidence),
          governanceVerdict: plan.governanceVerdict,
          requiredAuthority: undefined,
          relatedDecisionId: undefined,
          relatedActionPlanId: plan.id,
          consequenceOfInaction: isBlocked
            ? `Action "${plan.title}" remains blocked. Potential ${plan.expectedImpact || 'business impact'} will not be realized.`
            : `Delayed approval of "${plan.title}" may reduce the expected business outcome.`,
          recommendedReview: isBlocked
            ? 'Review governance constraints; consider escalation or policy adjustment.'
            : 'Review action plan details, expected impact, and confidence before approving or rejecting.',
          evidenceSufficiency: this.normalizeConfidence(plan.confidence) === 'INSUFFICIENT' ? 'INSUFFICIENT' as EvidenceSufficiency : 'SUFFICIENT' as EvidenceSufficiency,
        }));
      }
    }

    // 3. Surface forecast deviations requiring attention
    for (const forecast of state.activeForecasts) {
      if (forecast.direction === 'DECREASING' || forecast.direction === 'VOLATILE') {
        const delta = forecast.forecastValue - forecast.currentValue;
        const severity = forecast.direction === 'DECREASING' && Math.abs(delta) > forecast.currentValue * 0.1
          ? 'HIGH' as const
          : 'MEDIUM' as const;

        items.push(ExecutiveAttentionItemSchema.parse({
          id: `attn-forecast-${forecast.id}`,
          title: `${forecast.metric} forecast: ${forecast.direction}`,
          domain: forecast.domain,
          severity,
          priority: severity,
          whyNow: `${forecast.metric} is projected to ${forecast.direction === 'DECREASING' ? 'decline' : 'remain volatile'} over ${forecast.forecastHorizon}.`,
          businessImpact: delta !== 0
            ? `Forecast deviation of ${delta > 0 ? '+' : ''}${delta.toLocaleString()} on ${forecast.metric} (${forecast.confidence} confidence).`
            : `${forecast.metric} volatility detected.`,
          evidence: [
            `Current value: ${forecast.currentValue}`,
            `Forecast value: ${forecast.forecastValue}`,
            `Direction: ${forecast.direction}`,
            `Confidence: ${forecast.confidence}`,
            `Horizon: ${forecast.forecastHorizon}`,
          ],
          sourceIds: [forecast.id],
          currentState: `${forecast.metric}: ${forecast.currentValue}`,
          forecastState: `Projected: ${forecast.forecastValue} (${forecast.direction})`,
          risk: `${forecast.metric} trajectory is ${forecast.direction.toLowerCase()}, which may impact business targets.`,
          confidence: this.normalizeConfidence(forecast.confidence),
          governanceVerdict: undefined,
          requiredAuthority: undefined,
          relatedDecisionId: undefined,
          relatedActionPlanId: undefined,
          consequenceOfInaction: `Without intervention, ${forecast.metric} may reach ${forecast.forecastValue} (${forecast.direction}).`,
          recommendedReview: 'Review forecast assumptions, verify underlying telemetry, and evaluate whether corrective action plans exist.',
          evidenceSufficiency: this.normalizeConfidence(forecast.confidence) === 'INSUFFICIENT' ? 'INSUFFICIENT' as EvidenceSufficiency : 'SUFFICIENT' as EvidenceSufficiency,
        }));
      }
    }

    // 4. Surface learning signals with negative variance
    for (const signal of state.recentLearningSignals) {
      if (signal.varianceStatus === 'NEGATIVE_VARIANCE' || signal.varianceStatus === 'SIGNIFICANT_NEGATIVE') {
        items.push(ExecutiveAttentionItemSchema.parse({
          id: `attn-learning-${signal.id}`,
          title: `${signal.metric}: ${signal.varianceStatus.replace(/_/g, ' ').toLowerCase()}`,
          domain: signal.domain,
          severity: signal.varianceStatus === 'SIGNIFICANT_NEGATIVE' ? 'HIGH' as const : 'MEDIUM' as const,
          priority: signal.varianceStatus === 'SIGNIFICANT_NEGATIVE' ? 'HIGH' as const : 'MEDIUM' as const,
          whyNow: `Historical analysis shows ${signal.metric} is performing below expectations (${signal.varianceStatus}).`,
          businessImpact: `${signal.metric} variance may indicate strategy misalignment or external market shift.`,
          evidence: [
            `Metric: ${signal.metric}`,
            `Variance status: ${signal.varianceStatus}`,
            `Effectiveness: ${signal.effectiveness}`,
            `Hypothesis result: ${signal.hypothesisResult}`,
            `Confidence: ${signal.confidence}`,
          ],
          sourceIds: [signal.id],
          currentState: `${signal.metric}: ${signal.varianceStatus} (${signal.effectiveness})`,
          forecastState: undefined,
          risk: `Continued negative variance on ${signal.metric} may compound over time.`,
          confidence: this.normalizeConfidence(signal.confidence),
          governanceVerdict: undefined,
          requiredAuthority: undefined,
          relatedDecisionId: undefined,
          relatedActionPlanId: undefined,
          consequenceOfInaction: `Unaddressed ${signal.metric} variance may lead to cumulative performance degradation.`,
          recommendedReview: 'Examine the learning signal, review the original hypothesis, and determine if strategy adjustment is warranted.',
          evidenceSufficiency: this.normalizeConfidence(signal.confidence) === 'INSUFFICIENT' ? 'INSUFFICIENT' as EvidenceSufficiency : 'PARTIAL' as EvidenceSufficiency,
        }));
      }
    }

    // 5. Surface pending human-gated actions
    for (const pa of state.pendingActions) {
      items.push(ExecutiveAttentionItemSchema.parse({
        id: `attn-pending-${pa.id}`,
        title: `Pending action: ${pa.actionName}`,
        domain: pa.actionType || 'OPERATIONS',
        severity: this.mapRiskToSeverity(pa.riskLevel),
        priority: this.mapRiskToSeverity(pa.riskLevel),
        whyNow: `Human-gated action "${pa.actionName}" is waiting for execution approval.`,
        businessImpact: `${pa.actionType} action staged for human review.`,
        evidence: [
          `Action: ${pa.actionName}`,
          `Type: ${pa.actionType}`,
          `Risk level: ${pa.riskLevel}`,
          `Status: ${pa.status}`,
        ],
        sourceIds: [pa.id],
        currentState: `${pa.status} (risk: ${pa.riskLevel})`,
        forecastState: undefined,
        risk: `Action "${pa.actionName}" remains in pending queue.`,
        confidence: 'HIGH' as const,
        governanceVerdict: undefined,
        requiredAuthority: undefined,
        relatedDecisionId: undefined,
        relatedActionPlanId: undefined,
        consequenceOfInaction: `Staged action "${pa.actionName}" will not execute until manually approved.`,
        recommendedReview: 'Review action details, risk level, and execute or dismiss.',
        evidenceSufficiency: 'SUFFICIENT' as EvidenceSufficiency,
      }));
    }

    // Sort: CRITICAL > HIGH > MEDIUM > LOW, then by governance urgency
    return this.rankAttentionItems(items);
  }

  /**
   * Deterministic ranking: severity weight → priority weight → governance blocked first
   */
  private static rankAttentionItems(items: ExecutiveAttentionItem[]): ExecutiveAttentionItem[] {
    const severityWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const priorityWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    return items.sort((a, b) => {
      // 1. Severity descending
      const sevDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
      if (sevDiff !== 0) return sevDiff;

      // 2. Priority descending
      const priDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (priDiff !== 0) return priDiff;

      // 3. Governance blocked items surface first
      const aBlocked = a.governanceVerdict === 'BLOCKED' ? 1 : 0;
      const bBlocked = b.governanceVerdict === 'BLOCKED' ? 1 : 0;
      if (bBlocked !== aBlocked) return bBlocked - aBlocked;

      // 4. Stable sort by ID
      return a.id.localeCompare(b.id);
    });
  }

  private static mapPriorityToSeverity(priority: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (priority) {
      case 'CRITICAL': return 'CRITICAL';
      case 'HIGH': return 'HIGH';
      case 'MEDIUM': return 'MEDIUM';
      default: return 'LOW';
    }
  }

  private static mapRiskToSeverity(risk: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (risk) {
      case 'CRITICAL': return 'CRITICAL';
      case 'HIGH': return 'HIGH';
      case 'MEDIUM': return 'MEDIUM';
      default: return 'LOW';
    }
  }

  private static normalizePriority(p: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(p)) return p as any;
    return 'MEDIUM';
  }

  private static normalizeConfidence(c: string): 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT' {
    if (['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'].includes(c)) return c as any;
    return 'MEDIUM';
  }
}
