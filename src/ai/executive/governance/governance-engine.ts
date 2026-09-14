import {
  GovernanceEvaluationInput,
  GovernanceEvaluationResult,
  GovernanceVerdict,
  CapacityStatus,
  GoalAlignmentStatus,
  ApprovalAuthority,
  ExecutiveGovernancePolicy,
} from './types';

export class ExecutiveGovernanceEngine {
  /**
   * Deterministically evaluates a candidate strategy against organizational governance policies.
   */
  static evaluateStrategy(
    input: GovernanceEvaluationInput,
    policy: ExecutiveGovernancePolicy
  ): GovernanceEvaluationResult {
    const triggeredPolicies: string[] = [];
    const warnings: string[] = [];
    const violations: string[] = [];
    const escalationReasons: string[] = [];

    const financialExposure = input.estimatedFinancialExposure ?? 0;
    const maxExposure = policy.maxFinancialExposure;

    const restrictedDomains = policy.restrictedDomains || [];
    const restrictedActions = policy.restrictedActions || [];
    const conflictingGoalKeys = input.conflictingGoalKeys || [];
    const alignedGoalKeys = input.alignedGoalKeys || [];

    // 1. Restricted Domains & Actions Check (Hard Constraint)
    const isDomainRestricted = restrictedDomains.includes(input.domain);
    const isActionRestricted = restrictedActions.includes(input.actionName);

    if (isDomainRestricted) {
      violations.push(`Domain "${input.domain}" is restricted by organizational governance policy.`);
      triggeredPolicies.push('RESTRICTED_DOMAIN_POLICY');
    }

    if (isActionRestricted) {
      violations.push(`Action "${input.actionName}" is restricted by organizational governance policy.`);
      triggeredPolicies.push('RESTRICTED_ACTION_POLICY');
    }

    // 2. Financial Exposure Check (Hard / Escalation Constraint)
    if (financialExposure > maxExposure) {
      violations.push(
        `Estimated financial exposure ($${financialExposure.toLocaleString()}) exceeds organization policy ceiling of $${maxExposure.toLocaleString()}.`
      );
      triggeredPolicies.push('FINANCIAL_EXPOSURE_CEILING');
    } else if (financialExposure > maxExposure * 0.8) {
      warnings.push(
        `Financial exposure ($${financialExposure.toLocaleString()}) is approaching maximum threshold ($${maxExposure.toLocaleString()}).`
      );
      triggeredPolicies.push('FINANCIAL_EXPOSURE_WARNING_THRESHOLD');
    }

    // 3. Evidence & Confidence Evaluation (Epistemic Verification)
    const isConfidenceLow = input.confidence < policy.minEvidenceConfidence;
    const isEvidenceMissing = input.hasMissingEvidence;
    const isHypothesisRefuted = input.hasActiveRefutedHypothesis;

    if (isEvidenceMissing) {
      violations.push('Required metric or baseline evidence is missing/stale.');
      triggeredPolicies.push('EVIDENCE_COMPLETENESS_POLICY');
    }

    if (isConfidenceLow) {
      violations.push(
        `Strategy confidence (${input.confidence}%) is below organization minimum evidence threshold (${policy.minEvidenceConfidence}%).`
      );
      triggeredPolicies.push('MINIMUM_EVIDENCE_CONFIDENCE_POLICY');
    }

    if (isHypothesisRefuted) {
      warnings.push('Strategy relies on a historically refuted operational hypothesis.');
      escalationReasons.push('Historical outcome data shows prior failure under similar conditions.');
      triggeredPolicies.push('HISTORICAL_REFUTATION_SAFEGUARD');
    }

    // 4. Goal Alignment Evaluation
    let goalAlignmentStatus: GoalAlignmentStatus = 'ALIGNED';
    if (conflictingGoalKeys.length > 0) {
      goalAlignmentStatus = 'CONFLICTING';
      violations.push(`Strategy conflicts directly with active business goals: ${conflictingGoalKeys.join(', ')}.`);
      triggeredPolicies.push('GOAL_ALIGNMENT_POLICY');
    } else if (alignedGoalKeys.length === 0) {
      goalAlignmentStatus = 'UNKNOWN';
      warnings.push('Strategy has no direct alignment link to active strategic KPI milestones.');
    }


    // 5. Operational Capacity Evaluation
    let capacityStatus: CapacityStatus = 'CAPACITY_AVAILABLE';
    if (input.operationalPressure >= 80) {
      capacityStatus = 'CAPACITY_EXCEEDED';
      escalationReasons.push(
        `Operational pressure score (${input.operationalPressure}/100) exceeds team handling capacity.`
      );
      triggeredPolicies.push('OPERATIONAL_CAPACITY_LIMIT');
    } else if (input.operationalPressure >= 50) {
      capacityStatus = 'CAPACITY_PRESSURED';
      warnings.push(`Operational capacity is pressured (${input.operationalPressure}/100 overhead).`);
      triggeredPolicies.push('OPERATIONAL_CAPACITY_WARNING');
    }

    // 6. Risk Tolerance & Approval Authority Evaluation
    let requiredApproval: ApprovalAuthority = 'MANAGER';
    const riskScore = input.riskScore;

    // Risk tolerance mapping
    const maxRiskAllowed = policy.riskTolerance === 'LOW' ? 35 : policy.riskTolerance === 'MEDIUM' ? 65 : 85;

    if (riskScore > maxRiskAllowed) {
      escalationReasons.push(
        `Strategy risk score (${riskScore}/100) exceeds organization ${policy.riskTolerance} risk tolerance ceiling (${maxRiskAllowed} pts).`
      );
      triggeredPolicies.push('ORGANIZATIONAL_RISK_TOLERANCE_POLICY');
      requiredApproval = 'EXECUTIVE';
    }

    if (riskScore >= 70 || policy.requireExecutiveApprovalAboveRisk === 'HIGH') {
      if (riskScore >= 70) {
        requiredApproval = 'EXECUTIVE';
        escalationReasons.push('High strategic risk requires explicit Executive/Owner sign-off.');
        triggeredPolicies.push('EXECUTIVE_APPROVAL_MANDATE');
      }
    }

    // 7. Deterministic Precedence Resolution
    let verdict: GovernanceVerdict = 'ALLOWED';

    if (
      isDomainRestricted ||
      isActionRestricted ||
      financialExposure > maxExposure ||
      goalAlignmentStatus === 'CONFLICTING'
    ) {
      verdict = 'BLOCKED';
    } else if (isEvidenceMissing || isConfidenceLow) {
      verdict = 'INSUFFICIENT_EVIDENCE';
    } else if (escalationReasons.length > 0 || requiredApproval === 'EXECUTIVE') {
      verdict = 'REQUIRES_ESCALATION';
    } else if (warnings.length > 0 || capacityStatus === 'CAPACITY_PRESSURED') {
      verdict = 'ALLOWED_WITH_WARNING';
    } else {
      verdict = 'ALLOWED';
    }

    // 8. Grounded Structured Explanation
    const explanation = this.assembleExplanation({
      verdict,
      strategyName: input.strategyName,
      triggeredPolicies,
      violations,
      escalationReasons,
      warnings,
      requiredApproval,
      capacityStatus,
      goalAlignmentStatus,
    });

    return {
      strategyId: input.strategyId,
      strategyName: input.strategyName,
      verdict,
      riskTolerance: policy.riskTolerance,
      riskScore,
      capacityStatus,
      goalAlignmentStatus,
      requiredApproval,
      financialExposure,
      maxFinancialExposure: maxExposure,
      triggeredPolicies,
      warnings,
      violations,
      escalationReasons,
      explanation,
      policyVersion: policy.policyVersion,
      evaluatedAt: new Date(),
    };
  }

  private static assembleExplanation(ctx: {
    verdict: GovernanceVerdict;
    strategyName: string;
    triggeredPolicies: string[];
    violations: string[];
    escalationReasons: string[];
    warnings: string[];
    requiredApproval: ApprovalAuthority;
    capacityStatus: CapacityStatus;
    goalAlignmentStatus: GoalAlignmentStatus;
  }): string {
    const lines: string[] = [];
    lines.push(`Governance Verdict: ${ctx.verdict} for "${ctx.strategyName}".`);

    if (ctx.violations.length > 0) {
      lines.push(`Policy Violations: ${ctx.violations.join(' ')}`);
    }

    if (ctx.escalationReasons.length > 0) {
      lines.push(`Escalation Triggers: ${ctx.escalationReasons.join(' ')}`);
    }

    if (ctx.warnings.length > 0) {
      lines.push(`Governance Warnings: ${ctx.warnings.join(' ')}`);
    }

    lines.push(`Capacity Status: ${ctx.capacityStatus}. Goal Alignment: ${ctx.goalAlignmentStatus}.`);
    lines.push(`Required Approval Authority: ${ctx.requiredApproval}.`);

    return lines.join(' ');
  }
}
