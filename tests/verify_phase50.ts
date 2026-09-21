/**
 * Phase 50 Verification Suite: Controlled Pilot Onboarding & Governance Truthfulness
 *
 * Mandatory Verification Matrix:
 * 1. Default onboarding approval is false in UI initial state.
 * 2. Default target revenue is empty/unset in UI initial state.
 * 3. Missing target revenue creates no ARR target.
 * 4. Positive explicitly-entered target revenue creates ARR target.
 * 5. Unchecked approval does not self-approve baseline (remains PENDING without DECISION_APPROVED audit).
 * 6. Unauthorized non-executive role (MEMBER) cannot approve the baseline decision (returns HTTP 403).
 * 7. Authorized OWNER approval creates APPROVED decision with decidedByUserId and DECISION_APPROVED audit record.
 * 8. New goal is not marked ON_TRACK solely because currentValue is zero (persists as DRAFT).
 * 9. Existing empty-organization dashboard remains: overallScore = '—', status = 'UNRATED', evidence = INSUFFICIENT.
 * 10. Multi-tenant isolation is preserved during and post onboarding.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/db';
import { POST as onboardPOST } from '../src/app/api/auth/onboard/route';
import { setTestUserOverride } from '../src/lib/session';
import { ExecutiveDashboardService } from '../src/ai/executive/dashboard-service';
import { GoalTracker } from '../src/ai/executive/goal-tracker';

console.log('==========================================================================');
console.log('🧪 LEADMACHINE — PHASE 50 GOVERNANCE TRUTHFULNESS VERIFICATION');
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
  const ts = Date.now();

  // Test 1 & 2: Check onboarding page code to guarantee defaults
  await it('1. Default onboarding approval is false in UI initial state', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/onboarding/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    assert.ok(
      content.includes('initialDecisionApproved: false'),
      'UI state must initialize initialDecisionApproved as false'
    );
    assert.ok(
      !content.includes('initialDecisionApproved: true'),
      'UI state must never initialize initialDecisionApproved as true'
    );
  });

  await it('2. Default target revenue is empty/unset in UI initial state', async () => {
    const pagePath = path.join(process.cwd(), 'src/app/onboarding/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    assert.ok(
      content.includes('targetRevenue: ""'),
      'UI state must initialize targetRevenue as empty string'
    );
    assert.ok(
      !content.includes('targetRevenue: "500000"'),
      'UI state must not hardcode default revenue like 500000'
    );
    assert.ok(
      content.includes('disabled={isSubmitting || !profile.initialDecisionApproved}'),
      'UI must prevent final submission while approval is unchecked'
    );
  });

  // Test 3: Missing target revenue creates no ARR target
  const noGoalOrgId = `nogoal-org-${ts}`;
  const noGoalUserId = `nogoal-user-${ts}`;
  await prisma.organization.create({ data: { id: noGoalOrgId, name: `NoGoal Corp ${ts}` } });
  await prisma.user.create({
    data: {
      id: noGoalUserId,
      email: `nogoal_${ts}@example.com`,
      passwordHash: 'dummy_hash',
      name: 'NoGoal User',
      organizationId: noGoalOrgId,
      role: 'OWNER',
      onboarded: false,
    }
  });

  await it('3. Missing target revenue creates no ARR target', async () => {
    setTestUserOverride({
      id: noGoalUserId,
      email: `nogoal_${ts}@example.com`,
      role: 'OWNER',
      organizationId: noGoalOrgId,
      name: 'NoGoal User'
    });

    const req = new Request('http://localhost:3000/api/auth/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: `NoGoal Corp ${ts}`,
        industry: 'B2B SaaS',
        businessModel: 'Subscriptions',
        targetMarket: 'Founders',
        targetRevenue: '', // empty / unset
        operatingPriorities: 'Accelerate ARR Growth',
        initialDecisionApproved: true,
      })
    });

    const res = await onboardPOST(req);
    assert.strictEqual(res.status, 200);

    const goal = await prisma.businessGoal.findFirst({
      where: { organizationId: noGoalOrgId, kpiKey: 'ARR_TARGET' }
    });
    assert.strictEqual(goal, null, 'No business goal should be created when target revenue is empty');
  });

  // Test 5: Unchecked approval is rejected with HTTP 400 and does not complete onboarding
  const unapprovedOrgId = `unapproved-org-${ts}`;
  const unapprovedUserId = `unapproved-user-${ts}`;
  await prisma.organization.create({ data: { id: unapprovedOrgId, name: `Unapproved Corp ${ts}` } });
  await prisma.user.create({
    data: {
      id: unapprovedUserId,
      email: `unapproved_${ts}@example.com`,
      passwordHash: 'dummy_hash',
      name: 'Unapproved User',
      organizationId: unapprovedOrgId,
      role: 'OWNER',
      onboarded: false,
    }
  });

  await it('5. Unchecked approval is rejected with HTTP 400 and does not complete onboarding', async () => {
    setTestUserOverride({
      id: unapprovedUserId,
      email: `unapproved_${ts}@example.com`,
      role: 'OWNER',
      organizationId: unapprovedOrgId,
      name: 'Unapproved User'
    });

    const req = new Request('http://localhost:3000/api/auth/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: `Unapproved Corp ${ts}`,
        industry: 'B2B SaaS',
        businessModel: 'Subscriptions',
        targetMarket: 'Founders',
        targetRevenue: '',
        operatingPriorities: 'Accelerate ARR Growth',
        initialDecisionApproved: false, // MUST BE REJECTED
      })
    });

    const res = await onboardPOST(req);
    assert.strictEqual(res.status, 400, 'Must return 400 Bad Request when unchecked');
    const data = await res.json();
    assert.ok(data.error.includes('Explicit executive approval is required'), 'Error message must state explicit approval is required');

    const user = await prisma.user.findUnique({ where: { id: unapprovedUserId } });
    assert.strictEqual(user?.onboarded, false, 'User must not be marked onboarded');

    const decision = await prisma.executiveDecision.findFirst({
      where: { organizationId: unapprovedOrgId }
    });
    assert.strictEqual(decision, null, 'Must not create baseline decision if onboarding fails');
  });

  // Test 6: Unauthorized non-executive role cannot approve baseline decision
  const memberOrgId = `member-org-${ts}`;
  const memberUserId = `member-user-${ts}`;
  await prisma.organization.create({ data: { id: memberOrgId, name: `Member Corp ${ts}` } });
  await prisma.user.create({
    data: {
      id: memberUserId,
      email: `member_${ts}@example.com`,
      passwordHash: 'dummy_hash',
      name: 'Member User',
      organizationId: memberOrgId,
      role: 'MEMBER', // Ordinary non-executive member
      onboarded: false,
    }
  });

  await it('6. Unauthorized non-executive role cannot approve baseline decision (returns HTTP 403)', async () => {
    setTestUserOverride({
      id: memberUserId,
      email: `member_${ts}@example.com`,
      role: 'MEMBER',
      organizationId: memberOrgId,
      name: 'Member User'
    });

    const req = new Request('http://localhost:3000/api/auth/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: `Member Corp ${ts}`,
        targetRevenue: 500000,
        initialDecisionApproved: true, // Non-executive attempting baseline approval
      })
    });

    const res = await onboardPOST(req);
    assert.strictEqual(res.status, 403, 'Must return 403 Forbidden for non-executive approval attempt');
    const data = await res.json();
    assert.ok(data.error.includes('Executive authority') || data.error.includes('role'), 'Error must specify role/executive requirement');
  });

  // Test 4, 7, 8: Positive target revenue creates DRAFT goal, and OWNER approval creates APPROVED decision with audit
  const ownerOrgId = `owner-org-${ts}`;
  const ownerUserId = `owner-user-${ts}`;
  await prisma.organization.create({ data: { id: ownerOrgId, name: `Owner Corp ${ts}` } });
  await prisma.user.create({
    data: {
      id: ownerUserId,
      email: `owner_${ts}@example.com`,
      passwordHash: 'dummy_hash',
      name: 'Owner User',
      organizationId: ownerOrgId,
      role: 'OWNER',
      onboarded: false,
    }
  });

  await it('4. Positive explicitly-entered target revenue creates ARR target', async () => {
    setTestUserOverride({
      id: ownerUserId,
      email: `owner_${ts}@example.com`,
      role: 'OWNER',
      organizationId: ownerOrgId,
      name: 'Owner User'
    });

    const req = new Request('http://localhost:3000/api/auth/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: `Owner Corp ${ts}`,
        industry: 'B2B SaaS',
        businessModel: 'Subscriptions',
        targetMarket: 'Enterprise',
        targetRevenue: 600000,
        operatingPriorities: 'Accelerate ARR Growth',
        initialDecisionApproved: true,
      })
    });

    const res = await onboardPOST(req);
    assert.strictEqual(res.status, 200, 'Onboarding must succeed for OWNER');

    const goal = await prisma.businessGoal.findFirst({
      where: { organizationId: ownerOrgId, kpiKey: 'ARR_TARGET' }
    });
    assert.ok(goal, 'Business goal must be created');
    assert.strictEqual(goal.targetValue, 600000);
    assert.strictEqual(goal.currentValue, 0);
  });

  await it('7. Authorized OWNER approval creates APPROVED decision with decidedByUserId and DECISION_APPROVED audit', async () => {
    const decision = await prisma.executiveDecision.findFirst({
      where: { organizationId: ownerOrgId }
    });
    assert.ok(decision, 'Decision must exist');
    assert.strictEqual(decision.status, 'APPROVED');
    assert.strictEqual(decision.decidedByUserId, ownerUserId);

    const audit = await prisma.executiveDecisionAudit.findFirst({
      where: { decisionId: decision.id, event: 'DECISION_APPROVED' }
    });
    assert.ok(audit, 'DECISION_APPROVED audit record must exist');
    assert.strictEqual(audit.actorUserId, ownerUserId);
  });

  await it('8. New goal is not marked ON_TRACK solely because currentValue is zero (persists as DRAFT)', async () => {
    const goal = await prisma.businessGoal.findFirst({
      where: { organizationId: ownerOrgId, kpiKey: 'ARR_TARGET' }
    });
    assert.ok(goal, 'Business goal must exist');
    assert.strictEqual(goal.status, 'DRAFT', 'Goal status must be DRAFT for unmeasured initial state');
    assert.notStrictEqual(goal.status, 'ON_TRACK', 'Goal must NOT be falsely marked ON_TRACK');
  });

  await it('9. Existing empty-organization dashboard remains: overallScore = "—", status = "UNRATED", evidence = INSUFFICIENT', async () => {
    const emptyOrgId = `empty-org-${ts}`;
    await prisma.organization.create({ data: { id: emptyOrgId, name: `Empty Corp ${ts}` } });

    const snapshot = await ExecutiveDashboardService.getDashboardReadModel(emptyOrgId, {
      forceRefresh: true,
      mode: 'snapshot'
    });
    assert.strictEqual(snapshot?.health?.overallScore, '—', 'Empty org health score must be dash');
    assert.strictEqual(snapshot?.health?.status, 'UNRATED', 'Empty org health status must be UNRATED');
    assert.strictEqual(snapshot?.evidenceState?.overallEvidenceSufficiency, 'INSUFFICIENT');
  });

  await it('10. Multi-tenant isolation: Second org cannot access First org goals or decisions', async () => {
    const isolatedOrgId = `isolated-org-${ts}`;
    await prisma.organization.create({
      data: { id: isolatedOrgId, name: `Isolated Corp ${ts}` }
    });

    const goals = await GoalTracker.getActiveGoals(isolatedOrgId);
    assert.strictEqual(goals.length, 0, 'Isolated org must see 0 goals from other orgs');

    const decisions = await prisma.executiveDecision.findMany({ where: { organizationId: isolatedOrgId } });
    assert.strictEqual(decisions.length, 0, 'Isolated org must see 0 decisions from other orgs');
  });

  console.log('==========================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 50 GOVERNANCE TRUTHFULNESS TESTS PASSED`);
  console.log('==========================================================================\n');
}

runTests().catch((err) => {
  console.error('Phase 50 verification error:', err);
  process.exit(1);
});
