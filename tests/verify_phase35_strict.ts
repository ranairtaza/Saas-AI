import { prisma } from '../src/lib/db';
import { AttributionEngine } from '../src/ai/executive/outcomes/attribution-engine';
import { ExecutiveOperatingState } from '../src/ai/executive/operating-state/types';
import { ExecutiveValueLayer } from '../src/ai/executive/executive-value-layer';

async function main() {
  console.log('Starting Phase 35 Strict Verification Scenarios...');

  const orgA = await prisma.organization.create({ data: { name: 'Org A - Phase 35' } });
  const orgB = await prisma.organization.create({ data: { name: 'Org B - Phase 35' } });

  const conv = await prisma.conversation.create({
    data: {
      organizationId: orgA.id,
      userId: 'system',
      channel: 'WEB',
      status: 'ACTIVE',
    }
  });

  // Base parameters
  const baseParams = {
    prisma,
    outcomeId: 'mock',
    organizationId: orgA.id,
    targetKpiKey: 'unassigned_leads',
    baselineValue: 10,
    finalValue: 5,
    deltaValue: -5, // Favorable decrease
    deltaPercentage: -50,
  };

  try {
    // Scenario A: Proposed but never executed (No PendingAction)
    const resA = await AttributionEngine.evaluateCausality({
      ...baseParams,
      actionName: 'update_lead_status',
      pendingActionId: null
    });
    if (resA.level !== 'INSUFFICIENT_EVIDENCE') throw new Error(`Scenario A Failed: Expected INSUFFICIENT_EVIDENCE, got ${resA.level}`);

    // Scenario B: Approved but never executed (Status is WAITING/APPROVED)
    const paB = await prisma.pendingAction.create({
      data: {
        organizationId: orgA.id, requestingUserId: 'sys', actionArgs: '{}', humanDescription: 'test',
        idempotencyKey: `test-${Date.now()}-B`, expiresAt: new Date(Date.now() + 86400000),
        conversationId: conv.id, actionName: 'update_lead_status', actionType: 'OP', riskLevel: 'LOW',
        status: 'APPROVED'
      }
    });
    const resB = await AttributionEngine.evaluateCausality({
      ...baseParams, actionName: 'update_lead_status', pendingActionId: paB.id
    });
    if (resB.level !== 'INSUFFICIENT_EVIDENCE') throw new Error(`Scenario B Failed: Expected INSUFFICIENT_EVIDENCE, got ${resB.level}`);

    // Scenario C: Executed but no measurable outcome
    const paExec = await prisma.pendingAction.create({
      data: {
        organizationId: orgA.id, requestingUserId: 'sys', actionArgs: '{}', humanDescription: 'test',
        idempotencyKey: `test-${Date.now()}-exec`, expiresAt: new Date(Date.now() + 86400000),
        conversationId: conv.id, actionName: 'update_lead_status', actionType: 'OP', riskLevel: 'LOW',
        status: 'EXECUTED'
      }
    });
    const resC = await AttributionEngine.evaluateCausality({
      ...baseParams, actionName: 'update_lead_status', pendingActionId: paExec.id,
      finalValue: 10, deltaValue: 0, deltaPercentage: 0
    });
    if (resC.level !== 'INCONCLUSIVE') throw new Error(`Scenario C Failed: Expected INCONCLUSIVE, got ${resC.level}`);

    // Scenario D: Outcome occurred but no causal mechanism (CORRELATED)
    const resD = await AttributionEngine.evaluateCausality({
      ...baseParams, actionName: 'send_email', pendingActionId: paExec.id, targetKpiKey: 'revenue', deltaValue: 5, deltaPercentage: 50
    });
    if (resD.level !== 'CORRELATED') throw new Error(`Scenario D Failed: Expected CORRELATED, got ${resD.level}`);

    // Scenario E: Genuine deterministic causal mechanism
    // As per rule 2, since no such mechanism exists for aggregate KPIs, this must NOT return DIRECT_CAUSAL.
    const resE = await AttributionEngine.evaluateCausality({
      ...baseParams, actionName: 'assign_lead', pendingActionId: paExec.id
    });
    if (resE.level === 'DIRECT_CAUSAL') throw new Error(`Scenario E Failed: Manufactured causality detected.`);
    if (resE.level !== 'CORRELATED') throw new Error(`Scenario E Failed: Expected CORRELATED (non-causal), got ${resE.level}`);

    // Scenario F: Confounding factors downgrade
    // Downgrades from CORRELATED -> INCONCLUSIVE
    const resF = await AttributionEngine.evaluateCausality({
      ...baseParams, actionName: 'assign_lead', pendingActionId: paExec.id,
      confoundingFactors: ['another_action_happened']
    });
    if (resF.level !== 'INCONCLUSIVE') throw new Error(`Scenario F Failed: Expected INCONCLUSIVE (downgraded), got ${resF.level}`);

    // Scenario G: Missing baseline
    const resG = await AttributionEngine.evaluateCausality({
      ...baseParams, baselineValue: null as any, actionName: 'assign_lead', pendingActionId: paExec.id
    });
    if (resG.level !== 'INCONCLUSIVE') throw new Error(`Scenario G Failed: Expected INCONCLUSIVE, got ${resG.level}`);

    // Scenario H: Cross-tenant linkage
    const paOrgB = await prisma.pendingAction.create({
      data: {
        organizationId: orgB.id, requestingUserId: 'sys', actionArgs: '{}', humanDescription: 'test',
        idempotencyKey: `test-${Date.now()}-orgB`, expiresAt: new Date(Date.now() + 86400000),
        conversationId: conv.id, actionName: 'assign_lead', actionType: 'OP', riskLevel: 'LOW',
        status: 'EXECUTED'
      }
    });
    const resH = await AttributionEngine.evaluateCausality({
      ...baseParams, organizationId: orgA.id, pendingActionId: paOrgB.id
    });
    if (resH.level !== 'INSUFFICIENT_EVIDENCE') throw new Error(`Scenario H Failed: Expected INSUFFICIENT_EVIDENCE, got ${resH.level}`);
    if (!resH.rationale.includes('DENIED')) throw new Error('Scenario H Failed: Expected DENIED string in rationale');

    // Scenario I: Idempotent processing (Prisma unique constraint on outcomeId in Attribution)
    const mockOutcome = await prisma.executiveOutcome.create({
       data: {
         organization: { connect: { id: orgA.id } },
         status: 'MEASURED',
         domain: 'SALES',
         beforeSnapshot: '{}',
         baselineValue: 10,
         measurementWindowDays: 7,
         evaluationDueAt: new Date(),
         recommendation: {
           create: {
             organization: { connect: { id: orgA.id } },
             priorityScore: 100,
             priorityLevel: 'HIGH',
             title: 'test',
             executiveSummary: 'test',
             reasoning: '{}',
             expectedImpact: 'test',
             confidence: 'HIGH',
             actionProposal: '{}',
           }
         }
       }
    });
    await prisma.executiveOutcomeAttribution.create({
      data: {
        organizationId: orgA.id, outcomeId: mockOutcome.id, attributionStatus: 'DIRECT_CAUSAL',
        confidence: 'HIGH', targetMetric: 'unassigned', baselineValue: 10, actualDeltaValue: -5,
        attributionRationale: 'test'
      }
    });
    try {
      await prisma.executiveOutcomeAttribution.create({
        data: {
          organizationId: orgA.id, outcomeId: mockOutcome.id, attributionStatus: 'DIRECT_CAUSAL',
          confidence: 'HIGH', targetMetric: 'unassigned', baselineValue: 10, actualDeltaValue: -5,
          attributionRationale: 'duplicate'
        }
      });
      throw new Error('Scenario I Failed: Duplicate attribution was allowed');
    } catch (e: any) {
      if (e.message.includes('Scenario I Failed')) throw e;
      // Expected to fail with unique constraint violation
    }

    // Scenario J: Phase 34 value integration
    const mockState = {
      organizationId: orgA.id, timestamp: new Date().toISOString(), actionPlans: [], activeDecisions: [],
      activeForecasts: [], businessContext: null as any,
      pendingActions: [],
      recentLearningSignals: [],
      metricsSummary: [],
      recentOutcomeAttributions: [
        { attributionStatus: 'CORRELATED', targetMetric: 'REVENUE', actualDeltaValue: 10 } as any,
        { attributionStatus: 'DIRECT_CAUSAL', targetMetric: 'REVENUE', actualDeltaValue: 5 } as any,
      ]
    } as any;
    const synthesis = ExecutiveValueLayer.synthesize(mockState);
    if (!synthesis.commercialValueSignals.estimatedValueCreated?.includes('5.00')) {
      throw new Error(`Scenario J Failed: Expected ROI to only count DIRECT_CAUSAL (5), got ${synthesis.commercialValueSignals.estimatedValueCreated}`);
    }

    // Scenario K: Determinism
    const resK1 = await AttributionEngine.evaluateCausality({
      ...baseParams, actionName: 'assign_lead', pendingActionId: paExec.id
    });
    const resK2 = await AttributionEngine.evaluateCausality({
      ...baseParams, actionName: 'assign_lead', pendingActionId: paExec.id
    });
    if (JSON.stringify(resK1) !== JSON.stringify(resK2)) {
      throw new Error(`Scenario K Failed: Engine is not deterministic`);
    }

    console.log('✅ PHASE 35 — ALL STRICT ATTRIBUTION TESTS PASSED.');
    console.log('=======================================');
    console.log('       PHASE 35 — LOCKED');
    console.log('=======================================');

  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.organization.delete({ where: { id: orgA.id } });
    await prisma.organization.delete({ where: { id: orgB.id } });
    await prisma.$disconnect();
  }
}

main();
