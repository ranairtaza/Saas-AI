import { prisma } from '../../../lib/db';
import { assertDatabaseWritesAllowed } from '../../../lib/db-guard';
import {
  ExecutiveGovernancePolicy,
  ExecutiveGovernancePolicySchema,
} from './types';

export class GovernancePolicyService {
  /**
   * Returns default fallback governance policy for an organization.
   */
  static getDefaultPolicy(organizationId: string): ExecutiveGovernancePolicy {
    return {
      organizationId,
      riskTolerance: 'MEDIUM',
      maxFinancialExposure: 10000.0,
      maxLeadCapacityPerRep: 50,
      restrictedDomains: [],
      restrictedActions: [],
      minEvidenceConfidence: 70,
      requireExecutiveApprovalAboveRisk: 'HIGH',
      policyVersion: 1,
    };
  }

  /**
   * Retrieves the current governance policy for an organization.
   */
  static async getPolicy(organizationId: string): Promise<ExecutiveGovernancePolicy> {
    try {
      const dbPolicy = await prisma.executiveGovernancePolicy.findUnique({
        where: { organizationId },
      });

      if (!dbPolicy) {
        return this.getDefaultPolicy(organizationId);
      }

      return {
        id: dbPolicy.id,
        organizationId: dbPolicy.organizationId,
        riskTolerance: (dbPolicy.riskTolerance as any) || 'MEDIUM',
        maxFinancialExposure: dbPolicy.maxFinancialExposure,
        maxLeadCapacityPerRep: dbPolicy.maxLeadCapacityPerRep,
        restrictedDomains: JSON.parse(dbPolicy.restrictedDomains || '[]'),
        restrictedActions: JSON.parse(dbPolicy.restrictedActions || '[]'),
        minEvidenceConfidence: dbPolicy.minEvidenceConfidence,
        requireExecutiveApprovalAboveRisk: (dbPolicy.requireExecutiveApprovalAboveRisk as any) || 'HIGH',
        policyVersion: dbPolicy.policyVersion,
        createdAt: dbPolicy.createdAt,
        updatedAt: dbPolicy.updatedAt,
      };
    } catch (err) {
      console.warn(`[GovernancePolicyService] Fallback to default policy for org ${organizationId}:`, err);
      return this.getDefaultPolicy(organizationId);
    }
  }

  /**
   * Updates an organization's governance policy.
   * Enforces fail-closed write-guard safety.
   */
  static async updatePolicy(
    organizationId: string,
    updates: Partial<ExecutiveGovernancePolicy>
  ): Promise<ExecutiveGovernancePolicy> {
    assertDatabaseWritesAllowed('Update Executive Governance Policy');

    const current = await this.getPolicy(organizationId);
    const newVersion = current.policyVersion + 1;

    const saved = await prisma.executiveGovernancePolicy.upsert({
      where: { organizationId },
      create: {
        organizationId,
        riskTolerance: updates.riskTolerance ?? current.riskTolerance,
        maxFinancialExposure: updates.maxFinancialExposure ?? current.maxFinancialExposure,
        maxLeadCapacityPerRep: updates.maxLeadCapacityPerRep ?? current.maxLeadCapacityPerRep,
        restrictedDomains: JSON.stringify(updates.restrictedDomains ?? current.restrictedDomains),
        restrictedActions: JSON.stringify(updates.restrictedActions ?? current.restrictedActions),
        minEvidenceConfidence: updates.minEvidenceConfidence ?? current.minEvidenceConfidence,
        requireExecutiveApprovalAboveRisk: updates.requireExecutiveApprovalAboveRisk ?? current.requireExecutiveApprovalAboveRisk,
        policyVersion: newVersion,
      },
      update: {
        riskTolerance: updates.riskTolerance ?? current.riskTolerance,
        maxFinancialExposure: updates.maxFinancialExposure ?? current.maxFinancialExposure,
        maxLeadCapacityPerRep: updates.maxLeadCapacityPerRep ?? current.maxLeadCapacityPerRep,
        restrictedDomains: JSON.stringify(updates.restrictedDomains ?? current.restrictedDomains),
        restrictedActions: JSON.stringify(updates.restrictedActions ?? current.restrictedActions),
        minEvidenceConfidence: updates.minEvidenceConfidence ?? current.minEvidenceConfidence,
        requireExecutiveApprovalAboveRisk: updates.requireExecutiveApprovalAboveRisk ?? current.requireExecutiveApprovalAboveRisk,
        policyVersion: newVersion,
      },
    });

    return {
      id: saved.id,
      organizationId: saved.organizationId,
      riskTolerance: saved.riskTolerance as any,
      maxFinancialExposure: saved.maxFinancialExposure,
      maxLeadCapacityPerRep: saved.maxLeadCapacityPerRep,
      restrictedDomains: JSON.parse(saved.restrictedDomains),
      restrictedActions: JSON.parse(saved.restrictedActions),
      minEvidenceConfidence: saved.minEvidenceConfidence,
      requireExecutiveApprovalAboveRisk: saved.requireExecutiveApprovalAboveRisk as any,
      policyVersion: saved.policyVersion,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }
}
