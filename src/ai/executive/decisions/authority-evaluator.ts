import { DecisionAuthority } from './types';

export class DecisionAuthorityEvaluator {
  /**
   * Validates whether a user's role satisfies the required authority for a decision.
   */
  static isAuthorized(
    userRole: string,
    requiredAuthority: DecisionAuthority
  ): { authorized: boolean; reason?: string } {
    const role = (userRole || '').toUpperCase();

    switch (requiredAuthority) {
      case 'NONE':
        return { authorized: true };

      case 'MANAGER':
        if (role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER') {
          return { authorized: true };
        }
        return {
          authorized: false,
          reason: `Requires MANAGER or higher role authority. Current role "${userRole}" is insufficient.`,
        };

      case 'EXECUTIVE':
        if (role === 'OWNER' || role === 'ADMIN') {
          return { authorized: true };
        }
        return {
          authorized: false,
          reason: `Requires EXECUTIVE authority (OWNER or ADMIN role). Current role "${userRole}" is insufficient.`,
        };

      case 'EXPLICIT_HUMAN':
        if (role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER') {
          return { authorized: true };
        }
        return {
          authorized: false,
          reason: `Requires explicit authorized human approval (MANAGER, ADMIN, or OWNER). Role "${userRole}" is unauthorized.`,
        };

      default:
        return { authorized: false, reason: `Unknown authority requirement: ${requiredAuthority}` };
    }
  }

  /**
   * Deterministically determines the required authority given a governance verdict and risk score.
   */
  static determineAuthority(verdict: string, riskScore: number): DecisionAuthority {
    if (verdict === 'REQUIRES_ESCALATION' || riskScore >= 70) {
      return 'EXECUTIVE';
    }
    if (verdict === 'ALLOWED_WITH_WARNING' || riskScore >= 35) {
      return 'MANAGER';
    }
    if (verdict === 'ALLOWED') {
      return 'MANAGER';
    }
    return 'EXPLICIT_HUMAN';
  }
}
