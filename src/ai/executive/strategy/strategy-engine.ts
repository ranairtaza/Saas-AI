import {
  MultiDomainStrategyAnalysis,
  StrategicHypothesis,
  StrategicOption,
  StrategicRecommendation,
  BusinessDomain,
} from './types';
import { BusinessContext } from '../types';
import { CrossDomainDependencyEngine } from './dependency-engine';
import { StrategyScoringEngine } from './strategy-score';
import { ScenarioSimulationEngine } from './scenario-engine';
import { GovernancePolicyService } from '../governance/policy-service';
import { GovernanceFilter } from '../governance/governance-filter';
import { ExecutiveGovernancePolicy } from '../governance/types';

export class MultiDomainStrategyEngine {
  /**
   * Synthesizes cross-domain signals, hypotheses, scenarios, and strategic options for an organization.
   */
  static synthesizeStrategy(
    context: BusinessContext,
    customPolicy?: ExecutiveGovernancePolicy
  ): MultiDomainStrategyAnalysis {
    const orgId = context.organizationId;
    const telemetry = context.telemetry;

    const revenueMTD = telemetry.metrics.revenueMTD.value ?? 0;
    const pipelineValue = telemetry.metrics.pipelineValue.value ?? 0;
    const qualifiedLeads = telemetry.metrics.qualifiedLeads.value ?? 0;
    const unassignedLeads = telemetry.metrics.unassignedHighPriorityLeads.value ?? 0;

    // 1. Cross-Domain Signal Extraction
    const crossDomainSignals: Array<{
      domain: BusinessDomain;
      status: 'HEALTHY' | 'STABLE' | 'ATTENTION_NEEDED' | 'CRITICAL_RISK';
      primaryMetric: string;
      currentValue: number;
      trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    }> = [
        {
          domain: 'REVENUE',
          status: revenueMTD >= 20000 ? 'HEALTHY' : 'ATTENTION_NEEDED',
          primaryMetric: 'revenueMTD',
          currentValue: revenueMTD,
          trend: 'STABLE',
        },
        {
          domain: 'PIPELINE',
          status: pipelineValue >= 100000 ? 'HEALTHY' : 'ATTENTION_NEEDED',
          primaryMetric: 'pipelineValue',
          currentValue: pipelineValue,
          trend: 'STABLE',
        },
        {
          domain: 'SALES',
          status: qualifiedLeads > 5 ? 'HEALTHY' : 'ATTENTION_NEEDED',
          primaryMetric: 'qualifiedLeadsCount',
          currentValue: qualifiedLeads,
          trend: 'INCREASING',
        },
        {
          domain: 'OPERATIONS',
          status: unassignedLeads === 0 ? 'HEALTHY' : 'ATTENTION_NEEDED',
          primaryMetric: 'unassignedHighPriorityLeads',
          currentValue: unassignedLeads,
          trend: unassignedLeads > 0 ? 'DECREASING' : 'STABLE',
        },
      ];

    // 2. Cross-Domain Dependencies
    const dependencies = CrossDomainDependencyEngine.analyzeDependencies(context);

    // 3. Strategic Hypotheses Synthesis
    const strategicHypotheses: StrategicHypothesis[] = [];
    const refutedWarnings: string[] = [];

    // Check for historical validated/refuted items
    const historical = context.historicalPerformance;
    if (historical?.refutedHypotheses && historical.refutedHypotheses.length > 0) {
      refutedWarnings.push(...historical.refutedHypotheses);
    }

    if (unassignedLeads > 0) {
      strategicHypotheses.push({
        id: 'hyp-ops-lead-velocity',
        hypothesis:
          'Eliminating the unassigned high-priority lead backlog will accelerate response velocity and increase pipeline conversion.',
        supportingFacts: [
          `Current unassigned high-priority leads: ${unassignedLeads}`,
          `Active pipeline value: $${pipelineValue.toLocaleString()}`,
        ],
        supportingMetrics: {
          unassignedLeads: unassignedLeads,
          pipelineValue: pipelineValue,
        },
        assumptions: [
          'Assigned reps have sufficient capacity to engage within 2 hours.',
          'Lead contact details are enriched and verified.',
        ],
        expectedImpact: 'Faster lead engagement and reduction of deal drop-off.',
        affectedDomains: ['OPERATIONS', 'SALES', 'PIPELINE'],
        confidence: 'HIGH',
        confidenceScore: 88,
        riskLevel: 'LOW',
        measurementPlan: 'Track 7-day conversion rate and unassigned lead count delta.',
        historicalValidation:
          historical?.topValidatedStrategies?.some((s) => {
            const lower = s.toLowerCase();
            return lower.includes('assign') || lower.includes('routing') || lower.includes('velocity') || lower.includes('unassigned');
          })
            ? 'SUPPORTED'
            : 'NO_PRIOR_DATA',
      });

    }

    strategicHypotheses.push({
      id: 'hyp-pipeline-expansion',
      hypothesis:
        'Expanding enriched account qualification may compound pipeline value over the next 30 days.',
      supportingFacts: [
        `Current qualified lead volume: ${qualifiedLeads}`,
        `Current monthly revenue: $${revenueMTD.toLocaleString()}`,
      ],
      supportingMetrics: {
        qualifiedLeadsCount: qualifiedLeads,
        revenueMTD: revenueMTD,
      },
      assumptions: [
        'Average deal value remains consistent with historical deals.',
        'Target ICP enrichment accuracy remains above 90%.',
      ],
      expectedImpact: 'Potential pipeline expansion with downstream MRR realization.',
      affectedDomains: ['MARKETING', 'SALES', 'PIPELINE', 'REVENUE'],
      confidence: 'MEDIUM',
      confidenceScore: 78,
      riskLevel: 'MEDIUM',
      measurementPlan: 'Measure 30-day pipeline value delta against baseline.',
      historicalValidation: 'NO_PRIOR_DATA',
    });

    // 4. Strategic Options Generation
    const strategicOptions: StrategicOption[] = [];

    // Option A: Lead Assignment & Velocity Optimization
    const scoreA = StrategyScoringEngine.calculateScore({
      expectedImpact: unassignedLeads > 0 ? 85 : 55,
      goalAlignment: 80,
      evidenceStrength: 90,
      confidence: 85,
      risk: 20,
      operationalPressure: 25,
    });

    strategicOptions.push({
      id: 'opt-velocity-optimization',
      name: 'High-Priority Lead Routing & Response Velocity',
      domain: 'OPERATIONS',
      description:
        'Immediately distribute unassigned high-priority leads to available account executives with automated SLA alerts.',
      objective: 'Eliminate lead response latency and capture ready demand.',
      expectedImpact: unassignedLeads > 0 ? 85 : 55,
      goalAlignment: 80,
      evidenceStrength: 90,
      confidence: 85,
      risk: 20,
      operationalPressure: 25,
      strategicScore: scoreA,
      projectedOutcomes: [
        '100% reduction in unassigned high-priority leads.',
        'Improved response time from hours to <30 minutes.',
      ],
      tradeoffs: [
        'Requires immediate SDR/AE attention.',
        'May temporarily shift focus away from outbound discovery.',
      ],
      actionProposal: {
        actionName: 'assign_lead',
        actionArgs: {
          leadId: 'priority-backlog-all',
          note: 'Strategic Executive assignment for immediate SLA follow-up.',
        },
        requiresApproval: true,
      },
    });

    // Option B: Multi-Source Enrichment & Targeting Expansion
    const scoreB = StrategyScoringEngine.calculateScore({
      expectedImpact: 75,
      goalAlignment: 75,
      evidenceStrength: 70,
      confidence: 75,
      risk: 30,
      operationalPressure: 35,
    });

    strategicOptions.push({
      id: 'opt-enrichment-expansion',
      name: 'Account Enrichment & Qualification Expansion',
      domain: 'SALES',
      description:
        'Execute multi-source evidence enrichment across discovered enterprise leads to identify immediate buying intent.',
      objective: 'Increase qualified lead pipeline volume by 20%.',
      expectedImpact: 75,
      goalAlignment: 75,
      evidenceStrength: 70,
      confidence: 75,
      risk: 30,
      operationalPressure: 35,
      strategicScore: scoreB,
      projectedOutcomes: [
        'Identify 5-10 additional high-propensity target accounts.',
        'Enrich firmographic and tech stack signals.',
      ],
      tradeoffs: [
        'Consumes provider enrichment credits.',
        'Requires manual draft review for personalized outreach.',
      ],
      actionProposal: {
        actionName: 'enrich_lead',
        actionArgs: {
          strategy: 'multi_source_intent',
        },
        requiresApproval: true,
      },
    });

    // Option C: Conservative Pacing & Conversion Protection
    const scoreC = StrategyScoringEngine.calculateScore({
      expectedImpact: 60,
      goalAlignment: 65,
      evidenceStrength: 60,
      confidence: 70,
      risk: 15,
      operationalPressure: 15,
    });

    strategicOptions.push({
      id: 'opt-conversion-protection',
      name: 'Mid-Funnel Pipeline Protection',
      domain: 'REVENUE',
      description:
        'Focus sales bandwidth entirely on active mid-funnel deals to prevent deal slippage before month end.',
      objective: 'Secure existing pipeline closing milestones.',
      expectedImpact: 60,
      goalAlignment: 65,
      evidenceStrength: 60,
      confidence: 70,
      risk: 15,
      operationalPressure: 15,
      strategicScore: scoreC,
      projectedOutcomes: [
        'Maintain forecast predictability.',
        'Mitigate month-end deal push risks.',
      ],
      tradeoffs: [
        'Deprioritizes top-of-funnel discovery.',
        'Lower net-new pipeline additions.',
      ],
      actionProposal: {
        actionName: 'add_lead_note',
        actionArgs: {
          note: 'Executive focus: prioritize closing active pipeline deals.',
        },
        requiresApproval: true,
      },
    });

    // Rank options deterministically
    const comparison = StrategyScoringEngine.compareStrategies(
      orgId,
      strategicOptions,
      historical?.topValidatedStrategies || []
    );

    // Apply Executive Governance Policy
    const policy = customPolicy || GovernancePolicyService.getDefaultPolicy(orgId);
    const governanceFiltered = GovernanceFilter.evaluateAndFilter(comparison.options, context, policy);

    const selectedOption = governanceFiltered.leadingApprovedOption
      ? comparison.options.find((o) => o.id === governanceFiltered.leadingApprovedOption!.optionId) || comparison.options[0]
      : comparison.options[0];
    const alternativeOptions = comparison.options.filter((o) => o.id !== selectedOption.id);

    const leadGov = governanceFiltered.governedOptions.find((g) => g.optionId === selectedOption.id)?.governance;

    // 5. Run Scenario Simulation for the selected strategy
    const scenarioSimulation = ScenarioSimulationEngine.simulate(context, {
      organizationId: orgId,
      title: `Scenario: ${selectedOption.name}`,
      inputs: [
        {
          metric: selectedOption.domain === 'OPERATIONS' ? 'unassignedHighPriorityLeads' : 'qualifiedLeadsCount',
          domain: selectedOption.domain,
          variableType: selectedOption.domain === 'OPERATIONS' ? 'ABSOLUTE_CHANGE' : 'PERCENTAGE_CHANGE',
          baselineValue:
            selectedOption.domain === 'OPERATIONS'
              ? unassignedLeads
              : qualifiedLeads,
          changeValue: selectedOption.domain === 'OPERATIONS' ? -unassignedLeads : 20,
          unit: selectedOption.domain === 'OPERATIONS' ? 'leads' : '%',
        },
      ],
      projectionWindowDays: 30,
    });

    // 6. Assemble Strategic Recommendation
    const recommendedStrategy: StrategicRecommendation = {
      title: `Strategic Focus: ${selectedOption.name}`,
      objective: selectedOption.objective,
      primaryDomain: selectedOption.domain,
      secondaryDomains: ['SALES', 'PIPELINE', 'REVENUE'],
      strategicHypothesis: strategicHypotheses[0],
      selectedOption,
      alternativeOptions,
      supportingFacts: [
        `Baseline Monthly Revenue: $${revenueMTD.toLocaleString()}`,
        `Baseline Pipeline: $${pipelineValue.toLocaleString()}`,
        `Unassigned High-Priority Leads: ${unassignedLeads}`,
      ],
      scenarioProjection: scenarioSimulation,
      historicalValidationSummary:
        historical && historical.totalMeasured > 0
          ? `Validated by ${historical.totalMeasured} historical measured outcomes (${historical.successRatePct}% win rate).`
          : 'Grounded in real-time operational telemetry and baseline goals.',
      refutedHypothesisWarnings: refutedWarnings,
      measurementPlan: 'Evaluate 7-day operational deltas and 30-day pipeline value delta in Executive Outcomes.',
      recommendedNextStep: `Stage action "${selectedOption.actionProposal.actionName}" for human executive approval.`,
      requiresHumanApproval: true,
      governanceVerdict: leadGov?.verdict || 'ALLOWED',
      governanceExplanation: leadGov?.explanation || 'Permitted to proceed under organizational policy.',
    };

    return {
      organizationId: orgId,
      analyzedAt: new Date(),
      crossDomainSignals,
      dependencies,
      strategicHypotheses,
      strategicOptions: comparison.options,
      recommendedStrategy,
      refutedHypotheses: refutedWarnings,
      governedOptions: governanceFiltered.governedOptions,
      governanceSummary: {
        totalEvaluated: governanceFiltered.governedOptions.length,
        blockedCount: governanceFiltered.blockedOptionsCount,
        escalationCount: governanceFiltered.escalationRequiredCount,
        policyVersion: policy.policyVersion,
      },
    };
  }
}

