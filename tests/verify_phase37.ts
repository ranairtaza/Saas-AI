import assert from 'assert';
import {
  CreateActionPlanInputSchema,
  ApproveActionPlanInputSchema,
  RejectActionPlanInputSchema,
  DeferActionPlanInputSchema,
  ExecutiveActionPlanRecordSchema,
} from '../src/ai/executive/actions/types';
import { ActionPrioritizationEngine } from '../src/ai/executive/actions/prioritization-engine';
import { ExecutiveActionPlanner } from '../src/ai/executive/actions/action-planner';

console.log('==========================================================================');
console.log('🧪 LEADMACHINE — PHASE 37 VERIFICATION');
console.log('   Executive Action Plan & Human Governance Bridge Verification');
console.log('==========================================================================\n');

let passedTests = 0;
let totalTests = 0;

async function it(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    console.error(`❌ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runTests() {
  // 1. Canonical Idempotency Key Generation
  await it('Generates deterministic and collision-resistant canonical idempotency keys', () => {
    const key1 = ExecutiveActionPlanner.createCanonicalIdempotencyKey({
      organizationId: 'org-123',
      actionType: 'FOLLOW_UP_LEAD',
      sourceSignalId: 'sig-1',
      sourceForecastId: 'fore-1',
      target: 'lead_456',
      recommendationVersion: 'v1',
    });

    const key2 = ExecutiveActionPlanner.createCanonicalIdempotencyKey({
      organizationId: 'org-123',
      actionType: 'FOLLOW_UP_LEAD',
      sourceSignalId: 'sig-1',
      sourceForecastId: 'fore-1',
      target: 'lead_456',
      recommendationVersion: 'v1',
    });

    const keyDifferentTarget = ExecutiveActionPlanner.createCanonicalIdempotencyKey({
      organizationId: 'org-123',
      actionType: 'FOLLOW_UP_LEAD',
      sourceSignalId: 'sig-1',
      sourceForecastId: 'fore-1',
      target: 'lead_789',
      recommendationVersion: 'v1',
    });

    assert.strictEqual(key1, key2, 'Identical parameters must produce identical SHA-256 idempotency key');
    assert.notStrictEqual(key1, keyDifferentTarget, 'Different targets must yield distinct idempotency keys');
    assert.strictEqual(key1.length, 64, 'Key must be a valid 64-character SHA-256 hex string');
  });

  // 2. Action Prioritization Engine Invariants
  await it('ActionPrioritizationEngine accurately computes analytical composite score', () => {
    const highUrgencyResult = ActionPrioritizationEngine.calculatePriority({
      actionType: 'INVESTIGATE_REVENUE_DROP',
      businessImpactScore: 28,
      urgency: 'CRITICAL',
      riskLevel: 'CRITICAL',
      confidence: 'HIGH',
      expectedCost: 0,
      isReversible: true,
      governanceVerdict: 'ALLOWED',
    });

    assert(highUrgencyResult.rawScore >= 80, `Expected raw score >= 80, got ${highUrgencyResult.rawScore}`);
    assert.strictEqual(highUrgencyResult.priority, 'CRITICAL');
    assert.strictEqual(highUrgencyResult.isApprovable, true);
    assert.strictEqual(highUrgencyResult.actionability, 'APPROVABLE');
    assert.strictEqual(highUrgencyResult.scoreBreakdown.costReversibilityPoints, 5, 'Reversible zero-cost gets +5 bonus');
  });

  await it('ActionPrioritizationEngine preserves raw score but blocks actionability when governance verdict is BLOCKED', () => {
    const blockedResult = ActionPrioritizationEngine.calculatePriority({
      actionType: 'INVESTIGATE_REVENUE_DROP',
      businessImpactScore: 30,
      urgency: 'CRITICAL',
      riskLevel: 'CRITICAL',
      confidence: 'HIGH',
      expectedCost: 15000,
      isReversible: false,
      governanceVerdict: 'BLOCKED',
    });

    assert(blockedResult.rawScore > 60, 'Raw analytical score is not zeroed out by governance block');
    assert.strictEqual(blockedResult.isApprovable, false, 'Blocked action must never be marked approvable');
    assert.strictEqual(blockedResult.actionability, 'NON_APPROVABLE');
    assert(blockedResult.explanation.includes('NON_APPROVABLE due to governance BLOCKED policy'));
  });

  await it('ActionPrioritizationEngine sets REQUIRES_ESCALATION when verdict requires executive review', () => {
    const escalationResult = ActionPrioritizationEngine.calculatePriority({
      actionType: 'REVIEW_OPERATIONAL_RISK',
      urgency: 'HIGH',
      riskLevel: 'HIGH',
      confidence: 'MEDIUM',
      governanceVerdict: 'REQUIRES_ESCALATION',
    });

    assert.strictEqual(escalationResult.actionability, 'REQUIRES_ESCALATION');
    assert.strictEqual(escalationResult.isApprovable, true, 'Escalation items can be approved by authorized role');
  });

  // 3. Schema Validation & Contract Enforcement
  await it('RejectActionPlanInputSchema strictly enforces non-empty rejectionReason', () => {
    const validReject = RejectActionPlanInputSchema.safeParse({
      decidedByUserId: 'usr_owner_1',
      userRole: 'OWNER',
      rejectionReason: 'Exceeds current marketing risk tolerance threshold',
    });
    assert(validReject.success, 'Valid rejection input must pass validation');

    const invalidRejectEmptyReason = RejectActionPlanInputSchema.safeParse({
      decidedByUserId: 'usr_owner_1',
      userRole: 'OWNER',
      rejectionReason: '',
    });
    assert(!invalidRejectEmptyReason.success, 'Empty rejection reason must fail validation');

    const invalidRejectNoReason = RejectActionPlanInputSchema.safeParse({
      decidedByUserId: 'usr_owner_1',
      userRole: 'OWNER',
    });
    assert(!invalidRejectNoReason.success, 'Missing rejection reason must fail validation');
  });

  await it('ApproveActionPlanInputSchema validates role and staging preferences', () => {
    const validApprove = ApproveActionPlanInputSchema.safeParse({
      decidedByUserId: 'usr_admin_1',
      userRole: 'ADMIN',
      approvalReason: 'Approved as part of weekly pipeline optimization',
      stagePendingAction: true,
    });
    assert(validApprove.success);

    const invalidApproveRole = ApproveActionPlanInputSchema.safeParse({
      decidedByUserId: 'usr_1',
      userRole: 'GUEST' as any,
    });
    assert(!invalidApproveRole.success, 'Invalid role must fail schema validation');
  });

  await it('ExecutiveActionPlanRecordSchema correctly parses complete record', () => {
    const sampleRecord = {
      id: 'eap_test_1',
      organizationId: 'org_test_1',
      decisionId: 'dec_1',
      forecastId: null,
      learningSignalId: null,
      actionType: 'FOLLOW_UP_LEAD',
      domain: 'SALES',
      title: 'Follow up on high-value qualified lead',
      description: 'Lead score is 88 with high intent',
      whyNow: 'Lead viewed pricing page twice today',
      evidence: JSON.stringify([{ sourceType: 'TELEMETRY', detail: 'Page visits' }]),
      expectedImpact: 'Increase win probability by 15%',
      expectedMetricChange: 15,
      targetMetric: 'QUALIFIED_LEADS',
      timeHorizon: 'SHORT_TERM',
      expectedCost: 0,
      riskLevel: 'LOW',
      urgency: 'HIGH',
      priority: 'HIGH',
      priorityScore: 78,
      confidence: 'HIGH',
      governanceVerdict: 'ALLOWED',
      governanceExplanation: 'Compliant with lead outreach policy',
      requiredAuthority: 'MANAGER',
      status: 'PROPOSED',
      idempotencyKey: 'a'.repeat(64),
      dependencies: JSON.stringify([]),
      actionPayload: null,
      pendingActionId: null,
      approvedByUserId: null,
      approvedAt: null,
      rejectionReason: null,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const parseResult = ExecutiveActionPlanRecordSchema.safeParse(sampleRecord);
    assert(parseResult.success, `Schema validation failed: ${JSON.stringify(parseResult)}`);
  });

  console.log(`\n==========================================================================`);
  console.log(`🎉 PHASE 37 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`==========================================================================\n`);
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
