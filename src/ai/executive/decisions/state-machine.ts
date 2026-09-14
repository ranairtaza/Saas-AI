import { DecisionStatus } from './types';
import { GovernanceVerdict } from '../governance/types';

export class DecisionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
    PENDING: ['APPROVED', 'REJECTED', 'DEFERRED', 'EXPIRED', 'CANCELLED'],
    DEFERRED: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
    APPROVED: [], // Terminal
    REJECTED: [], // Terminal (human rejection)
    BLOCKED: [],  // Terminal (governance/system blocked)
    EXPIRED: [],  // Terminal
    CANCELLED: [],// Terminal
  };


  /**
   * Evaluates if a decision status transition is valid according to the state machine and governance constraints.
   */
  static validateTransition(
    currentStatus: DecisionStatus,
    targetStatus: DecisionStatus,
    governanceVerdict: GovernanceVerdict
  ): { valid: boolean; error?: string } {
    // 1. Check basic state transition validity
    const allowedTargets = this.VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      return {
        valid: false,
        error: `Invalid transition from ${currentStatus} to ${targetStatus}. Terminal states cannot transition.`,
      };
    }

    // 2. Governance Constraint Enforcement
    if (targetStatus === 'APPROVED') {
      if (governanceVerdict === 'BLOCKED') {
        return {
          valid: false,
          error: 'BLOCKED decisions cannot be approved for execution under organizational governance policy.',
        };
      }

      if (governanceVerdict === 'INSUFFICIENT_EVIDENCE') {
        return {
          valid: false,
          error: 'Decisions with INSUFFICIENT_EVIDENCE cannot be approved without a passing governance re-evaluation.',
        };
      }
    }

    return { valid: true };
  }
}
