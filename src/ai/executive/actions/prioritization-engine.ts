import {
  ActionPlanPriority,
  ActionPlanUrgency,
  ExecutiveActionType,
} from './types';
import { ForecastConfidence } from '../forecasting/types';
import { GovernanceVerdict } from '../governance/types';

export interface PrioritizationInput {
  actionType: ExecutiveActionType;
  businessImpactScore?: number; // 0 - 30
  urgency: ActionPlanUrgency;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: ForecastConfidence;
  expectedCost?: number;
  isReversible?: boolean;
  governanceVerdict: GovernanceVerdict;
}

export interface PrioritizationResult {
  priority: ActionPlanPriority;
  priorityScore: number;
  rawScore: number;
  isApprovable: boolean;
  actionability: 'APPROVABLE' | 'NON_APPROVABLE' | 'REQUIRES_ESCALATION';
  scoreBreakdown: {
    impactPoints: number;
    urgencyPoints: number;
    riskPoints: number;
    confidencePoints: number;
    costReversibilityPoints: number;
    governanceCapApplied: boolean;
  };
  explanation: string;
}

export class ActionPrioritizationEngine {
  /**
   * Deterministically calculates priority score and classification for an action plan.
   * Analytical Raw Priority Score is separated from Actionability / Governance.
   */
  static calculatePriority(input: PrioritizationInput): PrioritizationResult {
    // 1. Business Impact Points (0 - 30)
    let impactPoints = 15;
    if (input.businessImpactScore !== undefined) {
      impactPoints = Math.max(0, Math.min(30, Math.round(input.businessImpactScore)));
    } else {
      switch (input.actionType) {
        case 'INVESTIGATE_REVENUE_DROP':
        case 'REVIEW_OPERATIONAL_RISK':
          impactPoints = 26;
          break;
        case 'FOLLOW_UP_LEAD':
        case 'REVIEW_PIPELINE':
        case 'ALLOCATE_CAPACITY':
          impactPoints = 20;
          break;
        case 'CONTACT_CUSTOMER':
        case 'REVIEW_STRATEGY':
          impactPoints = 15;
          break;
        case 'REVIEW_MARKETING_PERFORMANCE':
        case 'REQUEST_HUMAN_DECISION':
        default:
          impactPoints = 10;
          break;
      }
    }

    // 2. Urgency Points (0 - 25)
    let urgencyPoints = 12;
    switch (input.urgency) {
      case 'CRITICAL':
        urgencyPoints = 25;
        break;
      case 'HIGH':
        urgencyPoints = 18;
        break;
      case 'MEDIUM':
        urgencyPoints = 12;
        break;
      case 'LOW':
      default:
        urgencyPoints = 5;
        break;
    }

    // 3. Predictive Risk Points (0 - 25)
    let riskPoints = 12;
    switch (input.riskLevel) {
      case 'CRITICAL':
        riskPoints = 25; // Critical risk requires prompt executive intervention
        break;
      case 'HIGH':
        riskPoints = 18;
        break;
      case 'MEDIUM':
        riskPoints = 12;
        break;
      case 'LOW':
      default:
        riskPoints = 5;
        break;
    }

    // 4. Evidence Confidence Points (0 - 15)
    let confidencePoints = 10;
    switch (input.confidence) {
      case 'HIGH':
        confidencePoints = 15;
        break;
      case 'MEDIUM':
        confidencePoints = 10;
        break;
      case 'LOW':
        confidencePoints = 5;
        break;
      case 'INSUFFICIENT':
      default:
        confidencePoints = 0;
        break;
    }

    // 5. Cost Feasibility & Reversibility Adjustment (-5 to +5)
    // Deterministic mapping:
    // - Reversible & cost = 0: +5 (fast, zero-risk)
    // - Reversible & cost <= 5000: +2
    // - Irreversible & cost > 10000: -5 (high cost & irreversible penalty)
    // - Irreversible or cost > 5000: -2
    // - Neutral: 0
    let costReversibilityPoints = 0;
    const isReversible = input.isReversible ?? true;
    const cost = input.expectedCost ?? 0;

    if (isReversible && cost === 0) {
      costReversibilityPoints = 5; // Fast, risk-free execution bonus
    } else if (!isReversible && cost > 10000) {
      costReversibilityPoints = -5; // High cost, irreversible penalty
    } else if (!isReversible || cost > 5000) {
      costReversibilityPoints = -2;
    } else {
      costReversibilityPoints = 2;
    }

    // Raw analytical composite score (0 - 100)
    let rawScore = impactPoints + urgencyPoints + riskPoints + confidencePoints + costReversibilityPoints;
    rawScore = Math.max(0, Math.min(100, rawScore));

    // Priority Category Mapping based on analytical score:
    // 80 - 100: CRITICAL
    // 60 - 79:  HIGH
    // 40 - 59:  MEDIUM
    // 0 - 39:   LOW
    let priority: ActionPlanPriority = 'MEDIUM';
    if (rawScore >= 80) {
      priority = 'CRITICAL';
    } else if (rawScore >= 60) {
      priority = 'HIGH';
    } else if (rawScore >= 40) {
      priority = 'MEDIUM';
    } else {
      priority = 'LOW';
    }

    // Governance Separation Invariant:
    // Raw priority reflects analytical importance and is NOT capped or zeroed out.
    // Actionability and approvability are dictated strictly by the governance verdict.
    const isBlocked = input.governanceVerdict === 'BLOCKED';
    const isEscalation = input.governanceVerdict === 'REQUIRES_ESCALATION';
    const isApprovable = !isBlocked;
    const actionability: 'APPROVABLE' | 'NON_APPROVABLE' | 'REQUIRES_ESCALATION' = isBlocked
      ? 'NON_APPROVABLE'
      : isEscalation
      ? 'REQUIRES_ESCALATION'
      : 'APPROVABLE';

    const explanation = isBlocked
      ? `Priority score (${rawScore}/100, ${priority}) reflects analytical urgency, but action is NON_APPROVABLE due to governance BLOCKED policy.`
      : `Priority ${priority} (${rawScore}/100) calculated from impact (${impactPoints}pts), urgency (${urgencyPoints}pts), risk (${riskPoints}pts), confidence (${confidencePoints}pts), and resource feasibility (${costReversibilityPoints >= 0 ? '+' : ''}${costReversibilityPoints}pts).`;

    return {
      priority,
      priorityScore: rawScore,
      rawScore,
      isApprovable,
      actionability,
      scoreBreakdown: {
        impactPoints,
        urgencyPoints,
        riskPoints,
        confidencePoints,
        costReversibilityPoints,
        governanceCapApplied: isBlocked,
      },
      explanation,
    };
  }
}
