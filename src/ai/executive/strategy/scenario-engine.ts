import {
  ScenarioInputVariable,
  ScenarioSimulationRequest,
  ScenarioSimulationResult,
  ProjectedMetricOutput,
  PropagatedEffect,
  BusinessDomain,
} from './types';
import { BusinessContext } from '../types';

export class ScenarioSimulationEngine {
  /**
   * Clamps a number to bounds safely, preventing NaN / Infinity.
   */
  private static clamp(value: number, min: number, max: number): number {
    if (isNaN(value) || !isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Rounds numbers cleanly to 2 decimal places for presentation while preserving mathematical precision.
   */
  private static round2(val: number): number {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Runs a deterministic scenario simulation from verified business context and scenario inputs.
   */
  static simulate(
    context: BusinessContext,
    request: ScenarioSimulationRequest
  ): ScenarioSimulationResult {
    const baselineSnapshot: Record<string, number> = {
      revenueMTD: context.telemetry.metrics.revenueMTD.value ?? 0,
      pipelineValue: context.telemetry.metrics.pipelineValue.value ?? 0,
      activeLeadsCount: context.telemetry.metrics.activeLeadsCount.value ?? 0,
      qualifiedLeadsCount: context.telemetry.metrics.qualifiedLeads.value ?? 0,
      unassignedHighPriorityLeads: context.telemetry.metrics.unassignedHighPriorityLeads.value ?? 0,
    };

    const projectedMetrics: ProjectedMetricOutput[] = [];
    const propagatedEffects: PropagatedEffect[] = [];
    const assumptions: string[] = [];
    const uncertainties: string[] = [];

    // Track simulated state changes
    let simulatedQualifiedLeads = baselineSnapshot.qualifiedLeadsCount;
    let simulatedPipelineValue = baselineSnapshot.pipelineValue;
    let simulatedRevenueMTD = baselineSnapshot.revenueMTD;
    let simulatedUnassigned = baselineSnapshot.unassignedHighPriorityLeads;

    for (const input of request.inputs) {
      // 1. Input Validation & Bounds Clamping
      const safeChange = this.clamp(input.changeValue, input.minValue ?? -100, input.maxValue ?? 500);

      let baselineVal = input.baselineValue !== undefined ? input.baselineValue : (baselineSnapshot[input.metric] ?? 0);
      let projectedVal = baselineVal;

      if (input.variableType === 'PERCENTAGE_CHANGE' || input.variableType === 'CONVERSION_CHANGE' || input.variableType === 'VOLUME_CHANGE') {
        const factor = 1 + safeChange / 100;
        projectedVal = Math.max(0, baselineVal * factor);
      } else if (input.variableType === 'ABSOLUTE_CHANGE' || input.variableType === 'CAPACITY_CHANGE') {
        projectedVal = Math.max(0, baselineVal + safeChange);
      }

      projectedVal = this.round2(projectedVal);
      const deltaVal = this.round2(projectedVal - baselineVal);
      const deltaPct = baselineVal === 0 ? (projectedVal > 0 ? 100 : 0) : this.round2((deltaVal / baselineVal) * 100);

      // Phase 50: Do not fabricate synthetic variance. Mark uncertainty bounds as null.
      const lowerBound = null;
      const upperBound = null;

      projectedMetrics.push({
        metric: input.metric,
        domain: input.domain,
        baselineValue: baselineVal,
        projectedValue: projectedVal,
        deltaValue: deltaVal,
        deltaPercentage: deltaPct,
        confidence: null,
        uncertaintyRange: {
          lowerBound,
          upperBound,
        },
      });

      assumptions.push(
        `Assumed ${input.metric} shifts by ${safeChange > 0 ? '+' : ''}${safeChange}${input.unit} from baseline of ${baselineVal}.`
      );

      // Update intermediate simulation states
      if (input.metric === 'qualifiedLeadsCount') {
        simulatedQualifiedLeads = projectedVal;
      } else if (input.metric === 'unassignedHighPriorityLeads') {
        simulatedUnassigned = projectedVal;
      } else if (input.metric === 'pipelineValue') {
        simulatedPipelineValue = projectedVal;
      } else if (input.metric === 'revenueMTD') {
        simulatedRevenueMTD = projectedVal;
      }
    }

    // 2. Deterministic Cross-Domain Effect Propagation
    // Propagation Rule A: Qualified Leads -> Pipeline Value
    const leadsInput = request.inputs.find((i) => i.metric === 'qualifiedLeadsCount');
    if (leadsInput && !request.inputs.some((i) => i.metric === 'pipelineValue')) {
      propagatedEffects.push({
        sourceMetric: 'qualifiedLeadsCount',
        targetMetric: 'pipelineValue',
        targetDomain: 'PIPELINE',
        impactDescription: `Qualified lead adjustment may propagate to pipeline value, but exact conversion elasticity requires historical telemetry.`,
        projectedDeltaPct: null,
        propagationStatus: 'UNKNOWN',
        rationale: 'Pipeline expands with qualified deal volume, but conversion rates depend on real data.',
      });
    }

    // Propagation Rule C: Unassigned Leads -> Operational Health
    const unassignedInput = request.inputs.find((i) => i.metric === 'unassignedHighPriorityLeads');
    if (unassignedInput) {
      if (unassignedInput.changeValue <= -100 || simulatedUnassigned === 0) {
        propagatedEffects.push({
          sourceMetric: 'unassignedHighPriorityLeads',
          targetMetric: 'operationsHealth',
          targetDomain: 'OPERATIONS',
          impactDescription: 'Clearing unassigned high-priority leads resolves operational response bottleneck.',
          projectedDeltaPct: 25,
          propagationStatus: 'DETERMINISTIC_PROJECTION',
          rationale: 'Direct operational efficiency gain from zero unassigned high-priority lead backlog.',
        });
      }
    }

    // 3. Projected Health Score Calculation
    // Base health score from current state
    const currentHealth = context.goals.length > 0 ? 70 : 65;
    let healthDelta = 0;

    if (simulatedRevenueMTD > baselineSnapshot.revenueMTD) {
      healthDelta += 5;
    } else if (simulatedRevenueMTD < baselineSnapshot.revenueMTD) {
      healthDelta -= 8;
    }

    if (simulatedPipelineValue > baselineSnapshot.pipelineValue) {
      healthDelta += 4;
    }

    if (simulatedUnassigned === 0 && baselineSnapshot.unassignedHighPriorityLeads > 0) {
      healthDelta += 6;
    }

    const projectedHealthScore = this.clamp(currentHealth + healthDelta, 0, 100);

    // 4. Uncertainty & Risk Assessment
    if (request.projectionWindowDays > 60) {
      uncertainties.push('Long projection horizon (>60 days) increases macroeconomic and competitive variance.');
    }
    if (request.inputs.some((i) => Math.abs(i.changeValue) > 50)) {
      uncertainties.push('High-magnitude variance (>50%) exceeds normal operational standard deviations.');
    }

    const riskScore = this.clamp(
      request.inputs.reduce((acc, i) => acc + Math.abs(i.changeValue) * 0.2, 10),
      5,
      95
    );

    const confidenceScore = this.clamp(100 - riskScore * 0.5, 40, 95);

    const crypto = require('crypto');
    return {
      scenarioId: `scen-${crypto.randomUUID()}`,
      title: request.title,
      organizationId: context.organizationId,
      simulatedAt: new Date(),
      inputs: request.inputs,
      baselineSnapshot,
      projectedMetrics,
      propagatedEffects,
      projectedHealthScore,
      healthScoreDelta: projectedHealthScore - currentHealth,
      assumptions,
      uncertainties,
      riskScore: Math.round(riskScore),
      confidenceScore: Math.round(confidenceScore),
    };
  }
}
