import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { DecisionAuthorityEvaluator } from '@/ai/executive/decisions/authority-evaluator';

const OnboardingInputSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required').optional(),
  industry: z.string().optional(),
  businessModel: z.string().optional(),
  targetMarket: z.string().optional(),
  targetRevenue: z.union([z.number(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(val);
    return isNaN(num) || num <= 0 ? undefined : num;
  }),
  operatingPriorities: z.string().optional(),
  initialDecisionApproved: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let jsonBody: any = {};
    try {
      jsonBody = await request.json();
    } catch {
      // Body may be empty
    }

    const parseResult = OnboardingInputSchema.safeParse(jsonBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid onboarding payload', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const payload = parseResult.data;

    // Strict Governance Authorization Check:
    // Explicit executive approval is REQUIRED to complete onboarding.
    if (!payload.initialDecisionApproved) {
      return NextResponse.json(
        { error: 'Explicit executive approval is required to complete onboarding.' },
        { status: 400 }
      );
    }

    const authCheck = DecisionAuthorityEvaluator.isAuthorized(user.role, 'EXECUTIVE');
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.reason || 'Forbidden: Executive authority (OWNER or ADMIN role) is required to approve baseline governance decisions.' },
        { status: 403 }
      );
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

      // Create BusinessGoal only when customer explicitly provided a valid positive targetRevenue
      if (payload.targetRevenue !== undefined && payload.targetRevenue > 0) {
        const existingGoal = await tx.businessGoal.findFirst({
          where: { organizationId: user.organizationId, kpiKey: 'ARR_TARGET' }
        });
        if (!existingGoal) {
          const targetVal = payload.targetRevenue;
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
              status: 'DRAFT', // Semantically neutral unmeasured state (not ON_TRACK)
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
              ? 'Explicitly approved by authorized executive during onboarding workflow.'
              : 'Staged during onboarding awaiting explicit executive review.',
            policyVersion: 1,
            riskScore: 10,
            financialExposure: 0,
            evidenceConfidence: 85,
            requestedByUserId: user.id,
            decidedByUserId: isApproved ? user.id : null,
            decidedAt: isApproved ? new Date() : null,
            decisionReason: isApproved ? 'Executive authorized baseline monitoring during onboarding' : null,
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
              reason: 'Approved by authorized executive during onboarding workflow',
              policyVersion: 1,
            }
          });
        }
      }
    }, { timeout: 15000, maxWait: 15000 });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Onboarding Error:', error);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}
