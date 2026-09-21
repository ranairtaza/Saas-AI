import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = await request.json();
    } catch (e) {
      // Body may be empty, which is fine for backward compatibility
    }

    // Wrap in a transaction to ensure user, profile, governance policy, goals, and initial decision update together
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { onboarded: true }
      });

      if (payload.businessName) {
        await tx.businessProfile.upsert({
          where: { organizationId: user.organizationId },
          create: {
            organizationId: user.organizationId,
            businessName: payload.businessName,
            industry: payload.industry || 'B2B SaaS',
            businessModel: payload.businessModel || 'Subscriptions',
            targetMarket: payload.targetMarket || 'General',
            operatingPriorities: payload.operatingPriorities || 'Accelerate ARR Growth'
          },
          update: {
            businessName: payload.businessName,
            industry: payload.industry || 'B2B SaaS',
            businessModel: payload.businessModel || 'Subscriptions',
            targetMarket: payload.targetMarket || 'General',
            operatingPriorities: payload.operatingPriorities || 'Accelerate ARR Growth'
          }
        });
      }

      // Initialize default governance policy if none exists
      const existingPolicy = await tx.executiveGovernancePolicy.findFirst({
        where: { organizationId: user.organizationId }
      });
      if (!existingPolicy) {
        await tx.executiveGovernancePolicy.create({
          data: {
            organizationId: user.organizationId,
            policyVersion: 1,
            riskTolerance: 'BALANCED',
            maxFinancialExposure: 5000,
            minEvidenceConfidence: 70,
            requireExecutiveApprovalAboveRisk: 'HIGH',
            restrictedDomains: JSON.stringify([]),
            restrictedActions: JSON.stringify([]),
          }
        });
      }

      // Initialize initial business goal if provided
      if (payload.targetRevenue && Number(payload.targetRevenue) > 0) {
        const existingGoal = await tx.businessGoal.findFirst({
          where: { organizationId: user.organizationId, kpiKey: 'ARR_TARGET' }
        });
        if (!existingGoal) {
          const targetVal = Number(payload.targetRevenue);
          const endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1); // 1-year target
          await tx.businessGoal.create({
            data: {
              organizationId: user.organizationId,
              title: `Achieve $${targetVal.toLocaleString()} ARR Target`,
              kpiKey: 'ARR_TARGET',
              targetValue: targetVal,
              currentValue: 0,
              unit: 'CURRENCY',
              startDate: new Date(),
              endDate,
              status: 'ON_TRACK',
            }
          });
        }
      }

      // Record first executive decision baseline
      const decisionTitle = `Initialize telemetry & baseline criteria for ${payload.operatingPriorities || 'ARR Growth'}`;
      const existingDecision = await tx.executiveDecision.findFirst({
        where: { organizationId: user.organizationId, title: decisionTitle }
      });

      if (!existingDecision) {
        const isApproved = Boolean(payload.initialDecisionApproved);
        const decision = await tx.executiveDecision.create({
          data: {
            organizationId: user.organizationId,
            title: decisionTitle,
            description: `Baseline operational decision established during executive onboarding for priority: ${payload.operatingPriorities || 'Growth'}. Establishes ground-truth baseline for outcome attribution and anomaly detection.`,
            domain: 'GOVERNANCE',
            decisionType: 'OPERATIONAL',
            status: isApproved ? 'APPROVED' : 'PENDING',
            priority: 'MEDIUM',
            requiredAuthority: 'EXECUTIVE',
            governanceVerdict: 'ALLOWED',
            governanceExplanation: isApproved 
              ? 'Explicitly approved by organization owner during executive onboarding.'
              : 'Staged during onboarding awaiting explicit executive review.',
            policyVersion: 1,
            riskScore: 10,
            financialExposure: 0,
            evidenceConfidence: 85,
            requestedByUserId: user.id,
            decidedByUserId: isApproved ? user.id : null,
            decidedAt: isApproved ? new Date() : null,
            decisionReason: isApproved ? 'Owner approved baseline monitoring during onboarding' : null,
          }
        });

        if (isApproved) {
          await tx.executiveDecisionAudit.create({
            data: {
              decisionId: decision.id,
              organizationId: user.organizationId,
              actorUserId: user.id,
              event: 'DECISION_APPROVED',
              fromStatus: 'PENDING',
              toStatus: 'APPROVED',
              reason: 'Approved by business owner during onboarding workflow',
              policyVersion: 1,
            }
          });
        }
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Onboarding Error:', error);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}
