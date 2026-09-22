import {
  GovernedStrategicOption,
  ExecutiveGovernancePolicy,
} from './types';
import { StrategicOption } from '../strategy/types';
import { ExecutiveGovernanceEngine } from './governance-engine';
import { BusinessContext } from '../types';

export class GovernanceFilter {
  /**
   * Applies organizational governance policies to candidate strategic options.
   * Produces a filtered, governance-ranked list of strategic alternatives.
   */
  static evaluateAndFilter(
    options: StrategicOption[],
    context: BusinessContext,
    policy: ExecutiveGovernancePolicy
  ): {
    governedOptions: GovernedStrategicOption[];
    leadingApprovedOption: GovernedStrategicOption | null;
    blockedOptionsCount: number;
    escalationRequiredCount: number;
  } {
    const governedOptions: GovernedStrategicOption[] = [];

    const refuted = context.historicalPerformance?.refutedHypotheses || [];

    for (const opt of options) {
      const isRefuted = refuted.some(
        (r) =>
          r.toLowerCase().includes(opt.domain.toLowerCase()) ||
          r.toLowerCase().includes(opt.name.toLowerCase())
      );

      const govResult = ExecutiveGovernanceEngine.evaluateStrategy(
        {
          strategyId: opt.id,
          strategyName: opt.name,
          domain: opt.domain,
          actionName: opt.actionProposal.actionName,
          expectedImpact: opt.expectedImpact,
          evidenceStrength: opt.evidenceStrength,
          confidence: opt.confidence,
          riskScore: opt.risk,
          operationalPressure: opt.operationalPressure,
          estimatedFinancialExposure: 0, // Phase 50: Do not fabricate financial exposure.
          alignedGoalKeys: context.goals.map((g) => g.kpiKey),
          conflictingGoalKeys: [],
          hasActiveRefutedHypothesis: isRefuted,
          hasMissingEvidence: opt.confidence < 40,
        },
        policy
      );


      const isExecutable = govResult.verdict !== 'BLOCKED' && govResult.verdict !== 'INSUFFICIENT_EVIDENCE';

      governedOptions.push({
        optionId: opt.id,
        name: opt.name,
        domain: opt.domain,
        description: opt.description,
        strategicScore: opt.strategicScore,
        expectedImpact: opt.expectedImpact,
        confidence: opt.confidence,
        risk: opt.risk,
        governance: govResult,
        isExecutable,
      });
    }

    // Sort order:
    // 1. Executable options first (ALLOWED, ALLOWED_WITH_WARNING, REQUIRES_ESCALATION), sorted by strategicScore descending.
    // 2. Non-executable options next (INSUFFICIENT_EVIDENCE, BLOCKED), sorted by strategicScore descending.
    governedOptions.sort((a, b) => {
      if (a.isExecutable !== b.isExecutable) {
        return a.isExecutable ? -1 : 1;
      }
      if (a.governance.verdict === 'BLOCKED' && b.governance.verdict !== 'BLOCKED') {
        return 1;
      }
      if (b.governance.verdict === 'BLOCKED' && a.governance.verdict !== 'BLOCKED') {
        return -1;
      }
      return b.strategicScore - a.strategicScore;
    });

    const leadingApprovedOption = governedOptions.find((o) => o.isExecutable) || null;
    const blockedOptionsCount = governedOptions.filter((o) => o.governance.verdict === 'BLOCKED').length;
    const escalationRequiredCount = governedOptions.filter((o) => o.governance.verdict === 'REQUIRES_ESCALATION').length;

    return {
      governedOptions,
      leadingApprovedOption,
      blockedOptionsCount,
      escalationRequiredCount,
    };
  }
}
