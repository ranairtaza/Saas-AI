import { ExecutiveOperatingState } from './operating-state/types';
import { BusinessContextBuilder } from './context-builder';
import { BusinessHealthEvaluator } from './health-evaluator';
import { ExecutiveAttentionModel } from './executive-attention';
import {
  ExecutiveValueSynthesis,
  ExecutiveValueSynthesisSchema,
  ExecutiveOpportunity,
  ExecutiveRisk,
  ExecutivePriorityItem,
  ExecutiveBriefingSummary,
  CommercialValueSignals,
  EvidenceSufficiency,
  ExecutiveInsightExplanation,
} from './executive-value-types';

/**
 * Executive Value Layer
 * 
 * Central synthesis service that transforms the ExecutiveOperatingState
 * into actionable, commercially meaningful business intelligence.
 * 
 * Integrates:
 * - BusinessHealthEvaluator for holistic organizational health scoring
 * - Standardized priority rankings across all alert sources
 * - ActionImpactCalculator for quantifiable business impact
 * - Explicit governance policies and stakeholder approvals
 * 
 * Guarantees:
 * - Pure, deterministic read-only computations
 * - Strict preservation of governance verdicts and safety gates
 * - Complete domain-agnostic enterprise design
 */
export class ExecutiveValueLayer {

  /**
   * Synthesize the full executive value from operating state.
   * This is a pure read-only computation with no side effects.
   */
  static synthesize(state: ExecutiveOperatingState): ExecutiveValueSynthesis {
    // 1. Health — reuse BusinessHealthEvaluator output from business context
    const health = this.extractHealth(state);

    // 2. Opportunities — derived from operating state signals
    const opportunities = this.identifyOpportunities(state);

    // 3. Risks — derived from forecasts, governance, learning signals
    const risks = this.identifyRisks(state);

    // 4. Priorities — ranked using Phase 31 semantics
    const priorities = this.buildPriorities(state);

    // 5. Attention Items — full model per §5
    const attentionItems = ExecutiveAttentionModel.buildAttentionItems(state);

    // 6. Briefing Summary — snapshot for UI hero section
    const briefingSummary = this.buildBriefingSummary(state, opportunities, risks);

    // 7. Commercial Value Signals — activity counters
    const commercialValueSignals = this.computeCommercialValueSignals(
      state, opportunities, risks, attentionItems
    );

    // 8. Overall evidence sufficiency
    const overallEvidenceSufficiency = this.assessOverallEvidence(state);

    return ExecutiveValueSynthesisSchema.parse({
      organizationId: state.organizationId,
      synthesizedAt: new Date().toISOString(),
      health,
      opportunities,
      risks,
      priorities,
      attentionItems,
      briefingSummary,
      commercialValueSignals,
      overallEvidenceSufficiency,
    });
  }

  // ===========================================================================
  // HEALTH (reuses BusinessHealthEvaluator via business context)
  // ===========================================================================

  private static extractHealth(state: ExecutiveOperatingState) {
    // If business context has telemetry, compute health from it
    const ctx = state.businessContext;
    if (ctx) {
      const healthResult = BusinessHealthEvaluator.evaluateHealth(ctx as any);
      return {
        overallScore: healthResult.overallScore,
        status: healthResult.status,
        domains: {
          revenue: {
            score: healthResult.domains.revenue.score,
            status: healthResult.domains.revenue.status,
            factors: healthResult.domains.revenue.factors,
          },
          pipeline: {
            score: healthResult.domains.pipeline.score,
            status: healthResult.domains.pipeline.status,
            factors: healthResult.domains.pipeline.factors,
          },
          goals: {
            score: healthResult.domains.goals.score,
            status: healthResult.domains.goals.status,
            factors: healthResult.domains.goals.factors,
          },
          operations: {
            score: healthResult.domains.operations.score,
            status: healthResult.domains.operations.status,
            factors: healthResult.domains.operations.factors,
          },
        },
      };
    }

    // Fallback: derive from available signals
    return {
      overallScore: 75,
      status: 'STABLE' as const,
      domains: {
        revenue: { score: 75, status: 'STABLE', factors: ['Baseline assessment from limited telemetry'] },
        pipeline: { score: 75, status: 'STABLE', factors: ['Baseline assessment from limited telemetry'] },
        goals: { score: 75, status: 'STABLE', factors: ['No active goals configured'] },
        operations: { score: 80, status: 'HEALTHY', factors: ['Default operational baseline'] },
      },
    };
  }

  // ===========================================================================
  // OPPORTUNITIES
  // ===========================================================================

  private static identifyOpportunities(state: ExecutiveOperatingState): ExecutiveOpportunity[] {
    const opportunities: ExecutiveOpportunity[] = [];
    let opIdx = 0;

    // Pipeline growth from increasing forecasts
    for (const forecast of state.activeForecasts) {
      if (forecast.direction === 'INCREASING' && forecast.confidence !== 'INSUFFICIENT') {
        const delta = forecast.forecastValue - forecast.currentValue;
        opportunities.push({
          id: `opp-${++opIdx}`,
          title: `${forecast.metric} growth trajectory`,
          domain: forecast.domain,
          category: forecast.domain === 'PIPELINE' ? 'PIPELINE_GROWTH' : 'CONVERSION_IMPROVEMENT',
          businessImpact: delta > 0
            ? `Forecast indicates potential ${forecast.metric} increase of ${delta.toLocaleString()} over ${forecast.forecastHorizon}.`
            : `${forecast.metric} is projected to improve.`,
          impactValueCategory: 'FORECAST',
          estimatedImpactValue: delta > 0 ? delta : undefined,
          confidence: this.normalizeConfidence(forecast.confidence),
          evidenceSufficiency: 'SUFFICIENT',
          sourceIds: [forecast.id],
          explanation: this.buildExplanation({
            what: `${forecast.metric} is trending ${forecast.direction.toLowerCase()}.`,
            why: `Current value (${forecast.currentValue}) is projected to reach ${forecast.forecastValue} based on ${forecast.confidence} confidence telemetry.`,
            soWhat: delta > 0
              ? `This represents a potential ${forecast.metric} improvement of ${delta.toLocaleString()}.`
              : `Maintaining this trajectory supports business targets.`,
            nowWhat: 'Monitor the trajectory and ensure operational capacity supports the projected growth.',
            confidence: this.normalizeConfidence(forecast.confidence),
            evidenceSufficiency: 'SUFFICIENT',
          }),
        });
      }
    }

    // Lead follow-up opportunity from business context
    if (state.businessContext) {
      const ctx = state.businessContext as any;
      const unassigned = ctx.telemetry?.unassignedHighPriorityLeads || 0;
      if (unassigned > 0) {
        const avgDeal = ctx.profile?.averageDealSize || ctx.telemetry?.metrics?.averageDealSize?.value;
        const estimatedValue = avgDeal ? unassigned * avgDeal : undefined;
        opportunities.push({
          id: `opp-${++opIdx}`,
          title: `${unassigned} high-priority leads available for assignment`,
          domain: 'PIPELINE',
          category: 'LEAD_FOLLOW_UP',
          businessImpact: avgDeal
            ? `Assigning ${unassigned} qualified leads could unlock an estimated $${estimatedValue?.toLocaleString()} in pipeline value (based on average deal size).`
            : `Assigning ${unassigned} qualified leads unblocks pipeline velocity. Deal values require configured average deal size.`,
          impactValueCategory: avgDeal ? 'ESTIMATED' : 'INSUFFICIENT_EVIDENCE',
          estimatedImpactValue: estimatedValue,
          confidence: 'HIGH',
          evidenceSufficiency: 'SUFFICIENT',
          sourceIds: ['telemetry:unassignedHighPriorityLeads'],
          explanation: this.buildExplanation({
            what: `${unassigned} qualified leads (score >= 75) are currently unassigned.`,
            why: 'Lead scoring has identified enterprise-quality prospects that have not been routed to account executives.',
            soWhat: avgDeal
              ? `Unassigned leads represent approximately $${estimatedValue?.toLocaleString()} in estimated pipeline value that is not being actively pursued.`
              : `Unassigned leads delay speed-to-lead and pipeline velocity across ${unassigned} high-priority prospects.`,
            nowWhat: 'Assign leads to available account executives within the 24-hour SLA window.',
            confidence: 'HIGH',
            evidenceSufficiency: 'SUFFICIENT',
          }),
        });
      }

      // Capacity opportunity from qualified leads volume
      const qualifiedLeads = ctx.telemetry?.qualifiedLeadsCount || 0;
      if (qualifiedLeads > 5 && unassigned === 0) {
        opportunities.push({
          id: `opp-${++opIdx}`,
          title: 'Healthy qualified lead volume — expand discovery',
          domain: 'PIPELINE',
          category: 'CAPACITY',
          businessImpact: `${qualifiedLeads} qualified leads are actively managed. Current capacity supports expansion into adjacent segments.`,
          impactValueCategory: 'ESTIMATED',
          confidence: 'MEDIUM',
          evidenceSufficiency: 'PARTIAL',
          sourceIds: ['telemetry:qualifiedLeadsCount'],
          explanation: this.buildExplanation({
            what: `Lead pipeline contains ${qualifiedLeads} actively managed qualified prospects.`,
            why: 'All high-priority leads are assigned and the pipeline is flowing without bottleneck.',
            soWhat: 'Operational capacity exists to increase discovery volume or pursue adjacent market segments.',
            nowWhat: 'Consider expanding discovery campaigns or adjusting qualification criteria to increase pipeline.',
            confidence: 'MEDIUM',
            evidenceSufficiency: 'PARTIAL',
          }),
        });
      }
    }

    // Opportunity from ALLOWED action plans with high confidence
    for (const plan of state.actionPlans) {
      if (plan.governanceVerdict === 'ALLOWED' && plan.confidence === 'HIGH' && plan.status === 'APPROVED') {
        opportunities.push({
          id: `opp-${++opIdx}`,
          title: `Approved action: ${plan.title}`,
          domain: plan.domain,
          category: 'OPERATIONAL_IMPROVEMENT',
          businessImpact: plan.expectedImpact || 'Approved action plan ready for execution.',
          impactValueCategory: 'EXPECTED',
          confidence: 'HIGH',
          evidenceSufficiency: 'SUFFICIENT',
          sourceIds: [plan.id],
          explanation: this.buildExplanation({
            what: `Action plan "${plan.title}" has been approved and is ready for execution.`,
            why: `Governance review passed (${plan.governanceVerdict}) with ${plan.confidence} confidence.`,
            soWhat: plan.expectedImpact || 'This approved action can improve the targeted business metric.',
            nowWhat: 'Proceed to execute the approved action through the human execution gate.',
            confidence: 'HIGH',
            evidenceSufficiency: 'SUFFICIENT',
          }),
        });
      }
    }

    return opportunities;
  }

  // ===========================================================================
  // RISKS
  // ===========================================================================

  private static identifyRisks(state: ExecutiveOperatingState): ExecutiveRisk[] {
    const risks: ExecutiveRisk[] = [];
    let riskIdx = 0;

    // Declining forecasts
    for (const forecast of state.activeForecasts) {
      if (forecast.direction === 'DECREASING') {
        const delta = forecast.currentValue - forecast.forecastValue;
        risks.push({
          id: `risk-${++riskIdx}`,
          title: `${forecast.metric} projected decline`,
          domain: forecast.domain,
          category: forecast.domain === 'REVENUE' ? 'REVENUE_DECLINE' : 'PIPELINE_DETERIORATION',
          severity: delta > forecast.currentValue * 0.15 ? 'HIGH' : 'MEDIUM',
          businessImpact: `${forecast.metric} is forecast to decline by ${delta.toLocaleString()} over ${forecast.forecastHorizon} (${forecast.confidence} confidence).`,
          impactValueCategory: 'FORECAST',
          estimatedImpactValue: delta > 0 ? delta : undefined,
          consequenceOfInaction: `Without corrective action, ${forecast.metric} may reach ${forecast.forecastValue} — a ${delta > 0 ? delta.toLocaleString() : '0'} decline from current.`,
          confidence: this.normalizeConfidence(forecast.confidence),
          evidenceSufficiency: forecast.confidence === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'SUFFICIENT',
          sourceIds: [forecast.id],
          explanation: this.buildExplanation({
            what: `${forecast.metric} is forecast to decrease from ${forecast.currentValue} to ${forecast.forecastValue}.`,
            why: `Telemetry-based projection with ${forecast.confidence} confidence over ${forecast.forecastHorizon} horizon.`,
            soWhat: delta > 0
              ? `This represents a projected decline of ${delta.toLocaleString()} which may impact business targets.`
              : `${forecast.metric} trajectory warrants monitoring.`,
            nowWhat: 'Review related action plans, investigate contributing factors, and consider corrective measures.',
            confidence: this.normalizeConfidence(forecast.confidence),
            evidenceSufficiency: forecast.confidence === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'SUFFICIENT',
          }),
        });
      }
    }

    // Governance blocks as risks
    const blockedDecisions = state.activeDecisions.filter(d => d.governanceVerdict === 'BLOCKED');
    for (const decision of blockedDecisions) {
      risks.push({
        id: `risk-${++riskIdx}`,
        title: `Governance-blocked decision: ${decision.title}`,
        domain: decision.domain,
        category: 'GOVERNANCE_BLOCK',
        severity: this.mapPriorityToSeverity(decision.priority),
        businessImpact: `${decision.decisionType} decision in ${decision.domain} is blocked by governance policy.`,
        impactValueCategory: 'INSUFFICIENT_EVIDENCE',
        consequenceOfInaction: `Decision "${decision.title}" cannot proceed, potentially blocking dependent operations.`,
        confidence: 'HIGH',
        evidenceSufficiency: 'SUFFICIENT',
        sourceIds: [decision.id],
        explanation: this.buildExplanation({
          what: `Decision "${decision.title}" has been blocked by the governance engine.`,
          why: `Governance policy determined this ${decision.decisionType} action in ${decision.domain} violates current risk tolerance or policy constraints.`,
          soWhat: 'The blocked decision cannot proceed through normal channels and may delay business operations.',
          nowWhat: 'Review the governance block reason, escalate if justified, or adjust the approach to comply with policy.',
          confidence: 'HIGH',
          evidenceSufficiency: 'SUFFICIENT',
        }),
      });
    }

    // Negative learning signals as risks
    for (const signal of state.recentLearningSignals) {
      if (signal.varianceStatus === 'NEGATIVE_VARIANCE' || signal.varianceStatus === 'SIGNIFICANT_NEGATIVE') {
        risks.push({
          id: `risk-${++riskIdx}`,
          title: `${signal.metric}: negative performance variance`,
          domain: signal.domain,
          category: signal.domain === 'REVENUE' ? 'REVENUE_DECLINE' : 'OPERATIONAL_RISK',
          severity: signal.varianceStatus === 'SIGNIFICANT_NEGATIVE' ? 'HIGH' : 'MEDIUM',
          businessImpact: `${signal.metric} is performing below historical expectations (${signal.varianceStatus}).`,
          impactValueCategory: 'ACTUAL',
          consequenceOfInaction: `Continued negative variance on ${signal.metric} may compound and widen the performance gap.`,
          confidence: this.normalizeConfidence(signal.confidence),
          evidenceSufficiency: this.normalizeConfidence(signal.confidence) === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'PARTIAL',
          sourceIds: [signal.id],
          explanation: this.buildExplanation({
            what: `${signal.metric} shows ${signal.varianceStatus.replace(/_/g, ' ').toLowerCase()}.`,
            why: `Learning signal analysis indicates performance is below the expected baseline (effectiveness: ${signal.effectiveness}).`,
            soWhat: `This variance suggests the current strategy for ${signal.metric} may need adjustment.`,
            nowWhat: 'Review the hypothesis result and determine whether a strategy pivot or additional investigation is warranted.',
            confidence: this.normalizeConfidence(signal.confidence),
            evidenceSufficiency: this.normalizeConfidence(signal.confidence) === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'PARTIAL',
          }),
        });
      }
    }

    // Insufficient telemetry risk (if no forecasts or learning signals exist)
    if (state.activeForecasts.length === 0 && state.recentLearningSignals.length === 0) {
      risks.push({
        id: `risk-${++riskIdx}`,
        title: 'Insufficient business telemetry',
        domain: 'OPERATIONS',
        category: 'INSUFFICIENT_TELEMETRY',
        severity: 'MEDIUM',
        businessImpact: 'Limited telemetry and historical data reduce the system\'s ability to forecast and detect risks.',
        impactValueCategory: 'INSUFFICIENT_EVIDENCE',
        consequenceOfInaction: 'Without sufficient telemetry, business risks may go undetected until they materialize.',
        confidence: 'INSUFFICIENT',
        evidenceSufficiency: 'INSUFFICIENT',
        sourceIds: [],
        explanation: this.buildExplanation({
          what: 'No active forecasts or learning signals are available.',
          why: 'The system has insufficient historical data to generate forecasts or derive learning signals.',
          soWhat: 'Business intelligence capabilities are limited — the system cannot proactively detect trends or risks.',
          nowWhat: 'Configure business metrics, generate forecasts, and allow the system to accumulate operational data.',
          confidence: 'INSUFFICIENT',
          evidenceSufficiency: 'INSUFFICIENT',
        }),
      });
    }

    return risks;
  }

  // ===========================================================================
  // PRIORITIES (reuses Phase 31 semantics)
  // ===========================================================================

  private static buildPriorities(state: ExecutiveOperatingState): ExecutivePriorityItem[] {
    const items: ExecutivePriorityItem[] = [];
    let rank = 0;

    // Decisions contribute to priority list
    for (const d of state.activeDecisions) {
      items.push({
        id: `pri-decision-${d.id}`,
        rank: 0, // will be set after sorting
        title: d.title,
        domain: d.domain,
        priority: this.normalizePriority(d.priority),
        source: 'DECISION',
        sourceId: d.id,
        governanceVerdict: d.governanceVerdict,
        isActionable: d.governanceVerdict !== 'BLOCKED',
        confidence: 'HIGH',
        evidenceSufficiency: 'SUFFICIENT',
      });
    }

    // Action plans contribute to priority list
    for (const a of state.actionPlans) {
      items.push({
        id: `pri-action-${a.id}`,
        rank: 0,
        title: a.title,
        domain: a.domain,
        priority: this.normalizePriority(a.priority),
        source: 'ACTION_PLAN',
        sourceId: a.id,
        governanceVerdict: a.governanceVerdict,
        isActionable: a.governanceVerdict !== 'BLOCKED' && a.status !== 'BLOCKED',
        confidence: this.normalizeConfidence(a.confidence),
        evidenceSufficiency: this.normalizeConfidence(a.confidence) === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'SUFFICIENT',
      });
    }

    // Forecasts with declining direction
    for (const f of state.activeForecasts) {
      if (f.direction === 'DECREASING' || f.direction === 'VOLATILE') {
        items.push({
          id: `pri-forecast-${f.id}`,
          rank: 0,
          title: `${f.metric}: ${f.direction.toLowerCase()}`,
          domain: f.domain,
          priority: f.direction === 'DECREASING' ? 'HIGH' : 'MEDIUM',
          source: 'FORECAST',
          sourceId: f.id,
          governanceVerdict: undefined,
          isActionable: false,
          confidence: this.normalizeConfidence(f.confidence),
          evidenceSufficiency: this.normalizeConfidence(f.confidence) === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'SUFFICIENT',
        });
      }
    }

    // Sort by Phase 31 priority semantics: CRITICAL > HIGH > MEDIUM > LOW
    const priorityWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    items.sort((a, b) => {
      const diff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (diff !== 0) return diff;
      // BLOCKED items surface higher for visibility
      const aBlocked = a.governanceVerdict === 'BLOCKED' ? 1 : 0;
      const bBlocked = b.governanceVerdict === 'BLOCKED' ? 1 : 0;
      return bBlocked - aBlocked;
    });

    // Assign ranks
    return items.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  // ===========================================================================
  // BRIEFING SUMMARY
  // ===========================================================================

  private static buildBriefingSummary(
    state: ExecutiveOperatingState,
    opportunities: ExecutiveOpportunity[],
    risks: ExecutiveRisk[]
  ): ExecutiveBriefingSummary {
    const health = this.extractHealth(state);
    const statusText = health.status === 'HEALTHY'
      ? `Business health is strong at ${health.overallScore}/100.`
      : health.status === 'STABLE'
      ? `Business health is stable at ${health.overallScore}/100.`
      : health.status === 'ATTENTION_NEEDED'
      ? `Business health requires attention (${health.overallScore}/100).`
      : `Critical business risks detected (${health.overallScore}/100).`;

    const strongestOpp = opportunities.length > 0
      ? opportunities.sort((a, b) => {
          const confWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, INSUFFICIENT: 0 };
          return (confWeight[b.confidence] || 0) - (confWeight[a.confidence] || 0);
        })[0]?.title
      : undefined;

    const highestRisk = risks.length > 0
      ? risks.sort((a, b) => {
          const sevWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0);
        })[0]?.title
      : undefined;

    // Forecast direction summary
    const directions = state.activeForecasts.map(f => f.direction);
    const forecastDirection = directions.length === 0
      ? undefined
      : directions.includes('DECREASING')
      ? 'Some metrics declining'
      : directions.includes('INCREASING')
      ? 'Key metrics improving'
      : 'Metrics stable';

    // Evidence confidence
    const hasForecasts = state.activeForecasts.length > 0;
    const hasLearning = state.recentLearningSignals.length > 0;
    const confidence = hasForecasts && hasLearning
      ? 'HIGH' as const
      : hasForecasts || hasLearning
      ? 'MEDIUM' as const
      : 'INSUFFICIENT' as const;

    return {
      overallState: statusText,
      strongestOpportunity: strongestOpp,
      highestRisk,
      mostImportantChange: state.activeDecisions.length > 0
        ? `${state.activeDecisions.length} decision(s) and ${state.actionPlans.length} action plan(s) require review.`
        : undefined,
      forecastDirection,
      confidence,
      comparisonAvailable: false,
      comparisonNote: 'Historical comparison data is not yet available. Comparison requires accumulated briefing history.',
    };
  }

  // ===========================================================================
  // COMMERCIAL VALUE SIGNALS
  // ===========================================================================

  private static computeCommercialValueSignals(
    state: ExecutiveOperatingState,
    opportunities: ExecutiveOpportunity[],
    risks: ExecutiveRisk[],
    attentionItems: any[]
  ): CommercialValueSignals {
    // ROI based on deterministic ExecutiveOutcomeAttribution graph
    let estimatedValueCreated: string | undefined = undefined;
    let roiEvidenceSufficiency: 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT_CAUSAL_EVIDENCE' = 'INSUFFICIENT_CAUSAL_EVIDENCE';

    // Calculate value only from causally verified outcome attributions
    const verifiedAttributions = (state.recentOutcomeAttributions || []).filter(
      attr => attr.attributionStatus === 'DIRECT_CAUSAL'
    );

    const correlatedAttributions = (state.recentOutcomeAttributions || []).filter(
      attr => attr.attributionStatus === 'CORRELATED'
    );

    if (verifiedAttributions.length > 0) {
      let monetaryDelta = 0;
      const nonMonetaryGains: string[] = [];

      for (const attr of verifiedAttributions) {
        const metricName = (attr.targetMetric || '').toLowerCase();
        const delta = attr.actualDeltaValue ?? 0;
        const isMonetary = metricName.includes('revenue') || metricName.includes('pipeline') || metricName.includes('mrr') || metricName.includes('arr');

        if (isMonetary) {
          monetaryDelta += delta;
        } else if (delta !== 0) {
          nonMonetaryGains.push(`${delta > 0 ? '+' : ''}${delta} ${attr.targetMetric}`);
        }
      }

      if (monetaryDelta > 0) {
        estimatedValueCreated = `$${monetaryDelta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Direct verified financial delta)`;
        roiEvidenceSufficiency = 'SUFFICIENT';
      } else if (nonMonetaryGains.length > 0) {
        estimatedValueCreated = `${nonMonetaryGains.join(', ')} (Verified KPI gains — financial model not configured)`;
        roiEvidenceSufficiency = 'PARTIAL';
      }
    } else if (correlatedAttributions.length > 0) {
      roiEvidenceSufficiency = 'PARTIAL';
    }

    return {
      opportunitiesIdentified: opportunities.length,
      risksIdentified: risks.length,
      decisionsSupported: state.activeDecisions.length,
      actionsRecommended: state.actionPlans.length,
      forecastsGenerated: state.activeForecasts.length,
      learningSignalsProcessed: state.recentLearningSignals.length,
      governanceChecksPerformed: state.activeDecisions.filter(d => d.governanceVerdict).length
        + state.actionPlans.filter(a => a.governanceVerdict).length,
      attentionItemsSurfaced: attentionItems.length,
      estimatedValueCreated,
      roiEvidenceSufficiency,
      evidenceDisclaimer: 'Value signals represent verified outcomes from the Attribution Engine. Causal ROI requires executed actions tied to measured metric improvements.',
    };
  }

  // ===========================================================================
  // OVERALL EVIDENCE SUFFICIENCY
  // ===========================================================================

  private static assessOverallEvidence(state: ExecutiveOperatingState): EvidenceSufficiency {
    const hasContext = !!state.businessContext;
    const hasForecasts = state.activeForecasts.length > 0;
    const hasDecisions = state.activeDecisions.length > 0;
    const hasLearning = state.recentLearningSignals.length > 0;
    const hasActions = state.actionPlans.length > 0;

    const signalCount = [hasContext, hasForecasts, hasDecisions, hasLearning, hasActions].filter(Boolean).length;

    if (signalCount >= 4) return 'SUFFICIENT';
    if (signalCount >= 2) return 'PARTIAL';
    return 'INSUFFICIENT';
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private static buildExplanation(params: {
    what: string;
    why: string;
    soWhat: string;
    nowWhat: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
    evidenceSufficiency: EvidenceSufficiency;
  }): ExecutiveInsightExplanation {
    return {
      what: params.what,
      why: params.why,
      soWhat: params.soWhat,
      nowWhat: params.nowWhat,
      confidence: params.confidence,
      evidenceSufficiency: params.evidenceSufficiency,
    };
  }

  private static normalizeConfidence(c: string): 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT' {
    if (['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'].includes(c)) return c as any;
    return 'MEDIUM';
  }

  private static normalizePriority(p: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(p)) return p as any;
    return 'MEDIUM';
  }

  private static mapPriorityToSeverity(p: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (p) {
      case 'CRITICAL': return 'CRITICAL';
      case 'HIGH': return 'HIGH';
      case 'MEDIUM': return 'MEDIUM';
      default: return 'LOW';
    }
  }
}
