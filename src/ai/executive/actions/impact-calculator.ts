import { ExecutiveActionType } from './types';
import { ForecastConfidence, ForecastHorizon } from '../forecasting/types';

export interface ImpactCalculationInput {
  actionType: ExecutiveActionType;
  domain: string;
  confidence: ForecastConfidence;
  currentMetricValue?: number;
  forecastMetricValue?: number;
  targetMetric?: string;
  horizon: ForecastHorizon;
  telemetryEvidenceCount: number;
}

export interface ExpectedImpactResult {
  expectedImpact: string;
  expectedMetricChange?: number;
  targetMetric?: string;
  timeHorizon: ForecastHorizon;
  isSufficientEvidence: boolean;
  explanation: string;
}

export class ActionImpactCalculator {
  /**
   * Deterministically calculates expected impact from telemetry and forecast bounds.
   * Falls back safely to INSUFFICIENT_EVIDENCE when evidence is inadequate.
   */
  static calculateExpectedImpact(input: ImpactCalculationInput): ExpectedImpactResult {
    // 1. Epistemic Verification: Insufficient evidence guard
    if (
      input.confidence === 'INSUFFICIENT' ||
      input.telemetryEvidenceCount === 0 ||
      (input.currentMetricValue === undefined && input.forecastMetricValue === undefined)
    ) {
      return {
        expectedImpact: 'INSUFFICIENT_EVIDENCE',
        timeHorizon: input.horizon,
        isSufficientEvidence: false,
        explanation: 'Telemetry and forecast signals are insufficient to calculate bounded quantitative impact without fabrication.',
      };
    }

    const current = input.currentMetricValue ?? 0;
    const forecast = input.forecastMetricValue ?? current;
    const delta = forecast - current;

    let expectedChange = 0;
    let targetMetric = input.targetMetric || 'revenueMTD';
    let impactSummary = '';

    switch (input.actionType) {
      case 'FOLLOW_UP_LEAD':
        targetMetric = 'qualifiedLeadsCount';
        expectedChange = Math.max(1, Math.round(current * 0.25));
        impactSummary = `Expected recovery of up to ${expectedChange} qualified pipeline opportunities within ${input.horizon === 'SHORT_TERM' ? '14 days' : '30 days'}.`;
        break;

      case 'INVESTIGATE_REVENUE_DROP':
        targetMetric = 'revenueMTD';
        const revenueDeficit = Math.max(0, current - forecast);
        expectedChange = Math.round(revenueDeficit * 0.5);
        impactSummary = revenueDeficit > 0
          ? `Mitigate up to $${expectedChange.toLocaleString()} in projected revenue shortfall.`
          : 'Stabilize revenue run-rate and prevent unexpected variance.';
        break;

      case 'REVIEW_PIPELINE':
        targetMetric = 'pipelineValue';
        expectedChange = Math.max(0, Math.round(current * 0.15));
        impactSummary = `Re-engage stalled pipeline assets representing approximately $${expectedChange.toLocaleString()} in potential deal velocity.`;
        break;

      case 'ALLOCATE_CAPACITY':
        targetMetric = 'unassignedHighPriorityLeads';
        expectedChange = -Math.max(1, current); // reduction
        impactSummary = `Eliminate operational bottleneck by allocating ${Math.abs(expectedChange)} unassigned high-priority leads.`;
        break;

      case 'CONTACT_CUSTOMER':
        targetMetric = 'retentionRate';
        expectedChange = 5.0; // +5% retention
        impactSummary = 'Strengthen key account alignment to safeguard customer lifetime value.';
        break;

      case 'REVIEW_OPERATIONAL_RISK':
        targetMetric = 'operationalBacklog';
        expectedChange = -Math.max(1, Math.round(current * 0.3));
        impactSummary = 'De-risk critical operational bottlenecks before quarterly milestone cutoff.';
        break;

      case 'REVIEW_MARKETING_PERFORMANCE':
        targetMetric = 'leadVelocity';
        expectedChange = Math.round(current * 0.1);
        impactSummary = 'Identify and optimize highest-converting channel ROI.';
        break;

      case 'REVIEW_STRATEGY':
      case 'REQUEST_HUMAN_DECISION':
      default:
        targetMetric = 'strategicAlignment';
        expectedChange = 0;
        impactSummary = 'Clarify executive priority and unlock pending operational decisions.';
        break;
    }

    return {
      expectedImpact: impactSummary,
      expectedMetricChange: expectedChange,
      targetMetric,
      timeHorizon: input.horizon,
      isSufficientEvidence: true,
      explanation: `Deterministic projection based on current value (${current}) and ${input.confidence} confidence telemetry horizon.`,
    };
  }
}
