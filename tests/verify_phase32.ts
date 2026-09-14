import { prisma } from '../src/lib/db';
import {
  assertDatabaseWritesAllowed,
  getDatabaseWriteSafetyStatus,
  DatabaseWriteBlockedError,
  verifyDatabaseIdentity,
  EXPECTED_DATABASE_ID,
} from '../src/lib/db-guard';
import { ExecutiveOperatingSystemService } from '../src/ai/executive/operating-state/service';
import { ExecutiveOperatingStateSchema } from '../src/ai/executive/operating-state/types';
import { hasPermission } from '../src/permissions/rbac';
import { PERMISSIONS } from '../src/permissions/definitions';
import * as crypto from 'crypto';

// ============================================================================
// Utilities
// ============================================================================

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failCount++;
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  passCount++;
  console.log(`  ✓ ${message}`);
}

function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
    failCount++;
    console.error(`  ❌ FAILED: Expected error: ${message}`);
    throw new Error(`ASSERTION FAILED: Expected error: ${message}`);
  } catch (err: any) {
    if (err.message.startsWith('ASSERTION FAILED')) throw err;
    passCount++;
    console.log(`  ✓ ${message}`);
  }
}

// ============================================================================
// Test state holders
// ============================================================================

let ORG_A_ID = '';
let ORG_B_ID = '';

async function setup(): Promise<void> {
  // Create isolated test organizations
  const orgA = await prisma.organization.create({
    data: {
      name: `Phase32-Test-OrgA-${crypto.randomUUID().slice(0, 8)}`,
      timezone: 'UTC',
      locale: 'en-US',
    },
  });
  ORG_A_ID = orgA.id;

  const orgB = await prisma.organization.create({
    data: {
      name: `Phase32-Test-OrgB-${crypto.randomUUID().slice(0, 8)}`,
      timezone: 'UTC',
      locale: 'en-US',
    },
  });
  ORG_B_ID = orgB.id;

  // Governance Policy for Org A (Phase 27)
  await prisma.executiveGovernancePolicy.create({
    data: {
      organizationId: ORG_A_ID,
      riskTolerance: 'MEDIUM',
      maxFinancialExposure: 10000,
      restrictedDomains: JSON.stringify(['FINANCE']),
      restrictedActions: JSON.stringify(['EXECUTE_PAYMENT']),
      minEvidenceConfidence: 70,
      requireExecutiveApprovalAboveRisk: 'HIGH',
      policyVersion: 3,
    },
  });

  // Decision for Org A (Phase 28) — PENDING
  await prisma.executiveDecision.create({
    data: {
      organizationId: ORG_A_ID,
      title: 'Expand marketing budget Q3',
      description: 'Increase performance marketing spend by 20%',
      domain: 'MARKETING',
      decisionType: 'STRATEGIC',
      status: 'PENDING',
      priority: 'HIGH',
      requiredAuthority: 'EXECUTIVE',
      governanceVerdict: 'ALLOWED_WITH_WARNING',
      governanceExplanation: 'Financial exposure is approaching threshold.',
      riskScore: 60,
      financialExposure: 8000,
      evidenceConfidence: 80,
      policyVersion: 3,
    },
  });

  // Decision for Org A — BLOCKED
  await prisma.executiveDecision.create({
    data: {
      organizationId: ORG_A_ID,
      title: 'Restructure finance department',
      description: 'Automated financial realignment',
      domain: 'FINANCE',
      decisionType: 'FINANCIAL',
      status: 'PENDING',
      priority: 'CRITICAL',
      requiredAuthority: 'EXPLICIT_HUMAN',
      governanceVerdict: 'BLOCKED',
      governanceExplanation: 'Domain FINANCE is restricted by organizational policy.',
      riskScore: 95,
      financialExposure: 50000,
      evidenceConfidence: 30,
      policyVersion: 3,
    },
  });

  // Learning Signal for Org A (Phase 29)
  await prisma.executiveLearningSignal.create({
    data: {
      organizationId: ORG_A_ID,
      domain: 'REVENUE',
      metric: 'revenueMTD',
      expectedValue: 50000,
      actualValue: 42000,
      variance: -8000,
      variancePercentage: -16,
      varianceStatus: 'NEGATIVE',
      effectiveness: 'UNDERPERFORMED',
      confidence: 'HIGH',
      hypothesisResult: 'REFUTED',
      evidence: 'Revenue underperformed forecast by 16%.',
    },
  });

  // Forecast for Org A (Phase 30)
  await prisma.executiveForecast.create({
    data: {
      organizationId: ORG_A_ID,
      sourceType: 'TELEMETRY',
      domain: 'REVENUE',
      metric: 'revenueMTD',
      currentValue: 42000,
      forecastValue: 38000,
      forecastHorizon: 'SHORT_TERM',
      horizonDays: 30,
      lowerBound: 32000,
      upperBound: 44000,
      confidence: 'MEDIUM',
      direction: 'DECREASING',
      scenarioType: 'BASELINE',
      evidence: 'Revenue trending down per recent learning signal.',
      assumptions: JSON.stringify(['Current pipeline velocity continues']),
      riskSignals: JSON.stringify(['Revenue gap widening']),
    },
  });

  // Action Plan for Org A (Phase 31) — PROPOSED, ALLOWED
  await prisma.executiveActionPlan.create({
    data: {
      organizationId: ORG_A_ID,
      actionType: 'INVESTIGATE_REVENUE_DROP',
      domain: 'REVENUE',
      title: 'Investigate Q3 revenue shortfall',
      description: 'Root-cause the 16% revenue gap and identify corrective actions.',
      whyNow: 'Revenue pacing is lagging target milestone by 16%.',
      evidence: JSON.stringify(['Revenue underperformed forecast by 16%']),
      expectedImpact: 'Close 50% of revenue gap within 30 days.',
      expectedMetricChange: 4000,
      targetMetric: 'revenueMTD',
      timeHorizon: 'SHORT_TERM',
      expectedCost: 0,
      riskLevel: 'MEDIUM',
      urgency: 'HIGH',
      priority: 'CRITICAL',
      priorityScore: 88,
      confidence: 'HIGH',
      governanceVerdict: 'ALLOWED',
      governanceExplanation: 'Within organizational risk tolerance.',
      requiredAuthority: 'MANAGER',
      status: 'PROPOSED',
      idempotencyKey: crypto.randomUUID(),
    },
  });

  // Action Plan for Org A — BLOCKED by governance
  await prisma.executiveActionPlan.create({
    data: {
      organizationId: ORG_A_ID,
      actionType: 'REVIEW_PIPELINE',
      domain: 'FINANCE',
      title: 'Automated finance pipeline review',
      description: 'Autonomous financial pipeline restructuring.',
      whyNow: 'Finance domain needs attention.',
      evidence: JSON.stringify([]),
      expectedImpact: 'INSUFFICIENT_EVIDENCE',
      timeHorizon: 'MEDIUM_TERM',
      expectedCost: 15000,
      riskLevel: 'CRITICAL',
      urgency: 'MEDIUM',
      priority: 'HIGH',
      priorityScore: 75,
      confidence: 'LOW',
      governanceVerdict: 'BLOCKED',
      governanceExplanation: 'Domain FINANCE is restricted.',
      requiredAuthority: 'EXPLICIT_HUMAN',
      status: 'PROPOSED',
      idempotencyKey: crypto.randomUUID(),
    },
  });

  // Org B gets its own separate decision (for isolation testing)
  await prisma.executiveDecision.create({
    data: {
      organizationId: ORG_B_ID,
      title: 'Org B Private Decision',
      description: 'This should never appear in Org A state.',
      domain: 'OPERATIONS',
      decisionType: 'OPERATIONAL',
      status: 'PENDING',
      priority: 'LOW',
      requiredAuthority: 'NONE',
      governanceVerdict: 'ALLOWED',
      governanceExplanation: 'No restrictions.',
      policyVersion: 1,
    },
  });

  await prisma.executiveForecast.create({
    data: {
      organizationId: ORG_B_ID,
      sourceType: 'TELEMETRY',
      domain: 'OPERATIONS',
      metric: 'operationalEfficiency',
      currentValue: 85,
      forecastValue: 90,
      forecastHorizon: 'SHORT_TERM',
      horizonDays: 14,
      lowerBound: 80,
      upperBound: 95,
      confidence: 'HIGH',
      direction: 'INCREASING',
      scenarioType: 'BASELINE',
      evidence: 'Steady operational improvement.',
    },
  });

  await prisma.executiveLearningSignal.create({
    data: {
      organizationId: ORG_B_ID,
      domain: 'OPERATIONS',
      metric: 'operationalEfficiency',
      expectedValue: 80,
      actualValue: 85,
      variance: 5,
      variancePercentage: 6.25,
      varianceStatus: 'POSITIVE',
      effectiveness: 'SUCCESS',
      confidence: 'HIGH',
      hypothesisResult: 'SUPPORTED',
    },
  });

  await prisma.executiveActionPlan.create({
    data: {
      organizationId: ORG_B_ID,
      actionType: 'REVIEW_PIPELINE',
      domain: 'OPERATIONS',
      title: 'Org B Private Action Plan',
      description: 'Private to Org B.',
      whyNow: 'Internal Org B reason.',
      evidence: JSON.stringify([]),
      expectedImpact: 'Org B internal.',
      timeHorizon: 'SHORT_TERM',
      riskLevel: 'LOW',
      urgency: 'LOW',
      priority: 'LOW',
      priorityScore: 20,
      confidence: 'MEDIUM',
      governanceVerdict: 'ALLOWED',
      governanceExplanation: 'No restrictions.',
      requiredAuthority: 'NONE',
      status: 'PROPOSED',
      idempotencyKey: crypto.randomUUID(),
    },
  });
}

async function cleanup(): Promise<void> {
  for (const orgId of [ORG_A_ID, ORG_B_ID]) {
    if (!orgId) continue;
    await prisma.executiveActionPlan.deleteMany({ where: { organizationId: orgId } });
    await prisma.executiveForecast.deleteMany({ where: { organizationId: orgId } });
    await prisma.executiveLearningSignal.deleteMany({ where: { organizationId: orgId } });
    await prisma.executiveDecisionAudit.deleteMany({ where: { organizationId: orgId } });
    await prisma.executiveDecision.deleteMany({ where: { organizationId: orgId } });
    await prisma.executiveGovernancePolicy.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function test1_DatabaseIdentityAndSafety(): Promise<void> {
  console.log('\n--- 1. Database Identity & Safety ---');

  assert(
    process.env.LEADMACHINE_DATABASE_ID === 'leadmachine',
    'LEADMACHINE_DATABASE_ID is strictly "leadmachine"'
  );

  const identity = await verifyDatabaseIdentity(prisma);
  assert(identity.verified === true, 'Real PostgreSQL database identity verified via _leadmachine_metadata');
  assert(identity.application === 'leadmachine', `Application is "leadmachine" (got "${identity.application}")`);

  // DB write guard fail-closed test
  const origVal = process.env.LEADMACHINE_DB_WRITES_ENABLED;
  process.env.LEADMACHINE_DB_WRITES_ENABLED = '';
  const status = getDatabaseWriteSafetyStatus();
  assert(status.allowed === false, 'DB write guard fails closed when unconfigured');
  process.env.LEADMACHINE_DB_WRITES_ENABLED = origVal;
}

async function test2_DeterministicOperatingState(): Promise<void> {
  console.log('\n--- 2. Deterministic Operating State ---');

  const state1 = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);
  const state2 = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);

  // Strip timestamps for determinism comparison
  const strip = (s: any) => {
    const copy = JSON.parse(JSON.stringify(s));
    delete copy.timestamp;
    if (copy.businessContext) delete copy.businessContext.assembledAt;
    return JSON.stringify(copy);
  };

  assert(strip(state1) === strip(state2), 'Repeated calls produce deterministic output (excluding timestamps)');

  // Validate schema
  const parsed = ExecutiveOperatingStateSchema.safeParse(state1);
  assert(parsed.success === true, 'Output conforms to ExecutiveOperatingStateSchema');

  // Existing Phase 27-31 data is reused (not regenerated)
  assert(state1.activeGovernancePolicy !== null, 'Phase 27 governance policy reused');
  assert(state1.activeDecisions.length >= 2, `Phase 28 decisions reused (${state1.activeDecisions.length})`);
  assert(state1.recentLearningSignals.length >= 1, `Phase 29 learning signals reused (${state1.recentLearningSignals.length})`);
  assert(state1.activeForecasts.length >= 1, `Phase 30 forecasts reused (${state1.activeForecasts.length})`);
  assert(state1.actionPlans.length >= 2, `Phase 31 action plans reused (${state1.actionPlans.length})`);

  // Run 10 times for extended determinism check
  for (let i = 0; i < 10; i++) {
    const s = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);
    assert(strip(s) === strip(state1), `Determinism run ${i + 1}/10 identical`);
  }
}

async function test3_ZeroAutonomousSideEffects(): Promise<void> {
  console.log('\n--- 3. Zero Autonomous Side Effects ---');

  // Count state before
  const decisionsBefore = await prisma.executiveDecision.count({ where: { organizationId: ORG_A_ID } });
  const actionPlansBefore = await prisma.executiveActionPlan.count({ where: { organizationId: ORG_A_ID } });
  const pendingActionsBefore = await prisma.pendingAction.count({ where: { organizationId: ORG_A_ID } });
  const learningSignalsBefore = await prisma.executiveLearningSignal.count({ where: { organizationId: ORG_A_ID } });
  const forecastsBefore = await prisma.executiveForecast.count({ where: { organizationId: ORG_A_ID } });
  const auditLogsBefore = await prisma.auditLog.count({ where: { organizationId: ORG_A_ID } });

  // Call operating state 5 times
  for (let i = 0; i < 5; i++) {
    await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);
  }

  // Count state after
  const decisionsAfter = await prisma.executiveDecision.count({ where: { organizationId: ORG_A_ID } });
  const actionPlansAfter = await prisma.executiveActionPlan.count({ where: { organizationId: ORG_A_ID } });
  const pendingActionsAfter = await prisma.pendingAction.count({ where: { organizationId: ORG_A_ID } });
  const learningSignalsAfter = await prisma.executiveLearningSignal.count({ where: { organizationId: ORG_A_ID } });
  const forecastsAfter = await prisma.executiveForecast.count({ where: { organizationId: ORG_A_ID } });
  const auditLogsAfter = await prisma.auditLog.count({ where: { organizationId: ORG_A_ID } });

  assert(decisionsAfter === decisionsBefore, `AUTO_APPROVALS = 0 (decisions unchanged: ${decisionsBefore})`);
  assert(actionPlansAfter === actionPlansBefore, `AUTO_EXECUTIONS = 0 (action plans unchanged: ${actionPlansBefore})`);
  assert(pendingActionsAfter === pendingActionsBefore, `AUTO_PENDING_ACTIONS = 0 (pending actions unchanged: ${pendingActionsBefore})`);
  assert(learningSignalsAfter === learningSignalsBefore, `AUTO_LEARNING_SIGNALS = 0 (learning signals unchanged)`);
  assert(forecastsAfter === forecastsBefore, `AUTO_FORECASTS = 0 (forecasts unchanged)`);
  assert(auditLogsAfter === auditLogsBefore, `AUTO_AUDIT_LOGS = 0 (no audit side effects from read)`);

  // Verify no decision status mutations occurred
  const approvedDecisions = await prisma.executiveDecision.count({
    where: { organizationId: ORG_A_ID, status: 'APPROVED' },
  });
  assert(approvedDecisions === 0, 'AUTO_APPROVALS = 0 (no decisions auto-approved)');

  const rejectedDecisions = await prisma.executiveDecision.count({
    where: { organizationId: ORG_A_ID, status: 'REJECTED' },
  });
  assert(rejectedDecisions === 0, 'AUTO_REJECTIONS = 0 (no decisions auto-rejected)');

  // Explicit zero-email / zero-external-action verification (source code static analysis)
  const serviceSource = require('fs').readFileSync(
    require('path').resolve(__dirname, '../src/ai/executive/operating-state/service.ts'),
    'utf8'
  );
  assert(!serviceSource.includes('sendEmail'), 'AUTO_EMAILS = 0 (no email function references in service)');
  assert(!serviceSource.includes('executeAction'), 'AUTO_EXTERNAL_ACTIONS = 0 (no executeAction references in service)');
  assert(!serviceSource.includes('ActionEngine'), 'No ActionEngine references in operating-state service');
  assert(!serviceSource.includes('approve'), 'No approval logic in operating-state service');
  assert(!serviceSource.includes('reject'), 'No rejection logic in operating-state service');

  console.log('  ✓ AUTO_APPROVALS = 0');
  console.log('  ✓ AUTO_EXECUTIONS = 0');
  console.log('  ✓ AUTO_EMAILS = 0');
  console.log('  ✓ AUTO_EXTERNAL_ACTIONS = 0');
}

async function test4_GovernanceAuthority(): Promise<void> {
  console.log('\n--- 4. Governance Authority (Phase 27 Preservation) ---');

  const state = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);

  // Find BLOCKED decision
  const blockedDecision = state.activeDecisions.find((d) => d.governanceVerdict === 'BLOCKED');
  assert(blockedDecision !== undefined, 'BLOCKED decision appears in operating state');
  assert(blockedDecision!.status === 'PENDING', 'BLOCKED decision status remains PENDING (not auto-changed)');
  assert(blockedDecision!.governanceVerdict === 'BLOCKED', 'Governance verdict BLOCKED is preserved exactly');
  assert(blockedDecision!.priority === 'CRITICAL', 'BLOCKED decision retains CRITICAL priority (analytical importance preserved)');

  // Find BLOCKED action plan
  const blockedPlan = state.actionPlans.find((a) => a.governanceVerdict === 'BLOCKED');
  assert(blockedPlan !== undefined, 'BLOCKED action plan appears in operating state');
  assert(blockedPlan!.governanceVerdict === 'BLOCKED', 'BLOCKED → BLOCKED governance preserved in action plan');
  assert(blockedPlan!.priority === 'HIGH', 'BLOCKED action plan retains HIGH analytical priority');
  assert(blockedPlan!.status === 'PROPOSED', 'BLOCKED action plan status is PROPOSED (not auto-approved)');

  // Verify no second governance engine exists in operating-state code
  const serviceSource = require('fs').readFileSync(
    require('path').resolve(__dirname, '../src/ai/executive/operating-state/service.ts'),
    'utf8'
  );
  assert(
    !serviceSource.includes('GovernanceEngine'),
    'No second governance engine introduced in Phase 32'
  );
  assert(
    !serviceSource.includes('evaluateStrategy'),
    'No governance re-evaluation in operating-state synthesis'
  );
}

async function test5_Phase28Authority(): Promise<void> {
  console.log('\n--- 5. Phase 28 Authority (No Second Authorization Hierarchy) ---');

  const state = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);

  // Verify decisions carry original Phase 28 authority semantics
  const highAuthDecision = state.activeDecisions.find((d) => d.title === 'Restructure finance department');
  assert(highAuthDecision !== undefined, 'Phase 28 decision with EXPLICIT_HUMAN authority is in state');

  // Verify no new role rules in operating-state code
  const serviceSource = require('fs').readFileSync(
    require('path').resolve(__dirname, '../src/ai/executive/operating-state/service.ts'),
    'utf8'
  );
  assert(!serviceSource.includes('requiredAuthority'), 'No hardcoded authority rules in operating-state service');
  assert(!serviceSource.includes('OWNER'), 'No hardcoded role rules in operating-state service');
  assert(!serviceSource.includes('ADMIN'), 'No hardcoded ADMIN role in operating-state service');

  const typesSource = require('fs').readFileSync(
    require('path').resolve(__dirname, '../src/ai/executive/operating-state/types.ts'),
    'utf8'
  );
  assert(!typesSource.includes('ApprovalAuthority'), 'No new ApprovalAuthority type in operating-state types');
}

async function test6_TenantIsolation(): Promise<void> {
  console.log('\n--- 6. Tenant Isolation (Real PostgreSQL) ---');

  const stateA = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);
  const stateB = await ExecutiveOperatingSystemService.getOperatingState(ORG_B_ID);

  // Org A assertions
  assert(stateA.organizationId === ORG_A_ID, 'Org A state scoped to Org A ID');
  assert(
    stateA.activeDecisions.every((d) => !d.title.includes('Org B')),
    'Org A receives zero Org B decisions'
  );
  assert(
    stateA.activeForecasts.every((f) => f.domain !== 'OPERATIONS' || f.metric !== 'operationalEfficiency'),
    'Org A receives zero Org B forecasts'
  );
  assert(
    stateA.recentLearningSignals.every((s) => s.domain !== 'OPERATIONS' || s.metric !== 'operationalEfficiency'),
    'Org A receives zero Org B learning signals'
  );
  assert(
    stateA.actionPlans.every((a) => !a.title.includes('Org B')),
    'Org A receives zero Org B action plans'
  );

  // Org B assertions
  assert(stateB.organizationId === ORG_B_ID, 'Org B state scoped to Org B ID');
  assert(stateB.activeDecisions.length >= 1, 'Org B has its own decisions');
  assert(
    stateB.activeDecisions.every((d) => !d.title.includes('Expand marketing')),
    'Org B receives zero Org A decisions'
  );
  assert(
    stateB.activeForecasts.every((f) => f.metric !== 'revenueMTD'),
    'Org B receives zero Org A forecasts'
  );
  assert(
    stateB.actionPlans.every((a) => !a.title.includes('Investigate Q3')),
    'Org B receives zero Org A action plans'
  );

  assert(stateA.activeGovernancePolicy !== null, 'Org A has governance policy');
  assert(stateB.activeGovernancePolicy === null, 'Org B has no governance policy (not shared with Org A)');
}

async function test7_APISecurity(): Promise<void> {
  console.log('\n--- 7. API Security ---');

  // RBAC verification
  assert(
    hasPermission('OWNER' as any, PERMISSIONS.LEAD_READ) === true,
    'OWNER can access operating state (has lead:read)'
  );
  assert(
    hasPermission('ADMIN' as any, PERMISSIONS.LEAD_READ) === true,
    'ADMIN can access operating state'
  );
  assert(
    hasPermission('MANAGER' as any, PERMISSIONS.LEAD_READ) === true,
    'MANAGER can access operating state'
  );
  assert(
    hasPermission('MEMBER' as any, PERMISSIONS.LEAD_READ) === true,
    'MEMBER can access operating state (read only)'
  );
  assert(
    hasPermission('READ_ONLY' as any, PERMISSIONS.LEAD_READ) === true,
    'READ_ONLY can access operating state (read only)'
  );

  // Verify route enforces auth & org scoping (source verification)
  const routeSource = require('fs').readFileSync(
    require('path').resolve(__dirname, '../src/app/api/executive/operating-state/route.ts'),
    'utf8'
  );
  assert(routeSource.includes('getCurrentUser'), 'Route enforces authentication');
  assert(routeSource.includes('hasPermission'), 'Route enforces RBAC permission check');
  assert(routeSource.includes('user.organizationId'), 'Route scopes by user organization');
  assert(routeSource.includes('401'), 'Route returns 401 for unauthenticated');
  assert(routeSource.includes('403'), 'Route returns 403 for unauthorized');
  assert(!routeSource.includes('DATABASE_URL'), 'Route does not leak DATABASE_URL');
  assert(!routeSource.includes('password'), 'Route does not leak passwords');

  // Verify only GET method exists (no POST/PUT/DELETE mutations)
  assert(routeSource.includes('export async function GET'), 'GET method exists');
  assert(!routeSource.includes('export async function POST'), 'No POST mutation endpoint');
  assert(!routeSource.includes('export async function PUT'), 'No PUT mutation endpoint');
  assert(!routeSource.includes('export async function DELETE'), 'No DELETE mutation endpoint');
  assert(!routeSource.includes('export async function PATCH'), 'No PATCH mutation endpoint');
}

async function test8_CrossPhaseTraceability(): Promise<void> {
  console.log('\n--- 8. Cross-Phase Traceability ---');

  const state = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);

  // Every decision has an ID and governance verdict
  for (const d of state.activeDecisions) {
    assert(!!d.id, `Decision "${d.title}" has traceable ID`);
    assert(!!d.governanceVerdict, `Decision "${d.title}" has governance verdict`);
  }

  // Every learning signal has traceable origin
  for (const s of state.recentLearningSignals) {
    assert(!!s.id, `Learning signal for ${s.metric} has traceable ID`);
    assert(!!s.varianceStatus, `Learning signal for ${s.metric} has variance status`);
    assert(!!s.hypothesisResult, `Learning signal for ${s.metric} has hypothesis result`);
  }

  // Every forecast has traceable origin
  for (const f of state.activeForecasts) {
    assert(!!f.id, `Forecast for ${f.metric} has traceable ID`);
    assert(!!f.confidence, `Forecast for ${f.metric} has confidence`);
    assert(!!f.direction, `Forecast for ${f.metric} has direction`);
  }

  // Every action plan has traceable origin and governance
  for (const a of state.actionPlans) {
    assert(!!a.id, `Action plan "${a.title}" has traceable ID`);
    assert(!!a.governanceVerdict, `Action plan "${a.title}" has governance verdict`);
    assert(!!a.confidence, `Action plan "${a.title}" has confidence`);
  }

  // Verify INSUFFICIENT_EVIDENCE behavior
  const insufficientPlan = state.actionPlans.find((a) => a.expectedImpact === 'INSUFFICIENT_EVIDENCE');
  assert(
    insufficientPlan !== undefined,
    'INSUFFICIENT_EVIDENCE correctly surfaced for action plan with missing evidence'
  );
}

async function test9_ExecutivePriorityIntegrity(): Promise<void> {
  console.log('\n--- 9. Executive Priority Integrity ---');

  const state = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);

  // BLOCKED action plan: high priority score, but governance BLOCKED
  const blockedPlan = state.actionPlans.find((a) => a.governanceVerdict === 'BLOCKED');
  assert(blockedPlan !== undefined, 'BLOCKED action plan present');
  assert(blockedPlan!.priority === 'HIGH', 'BLOCKED plan retains HIGH raw priority');
  assert(blockedPlan!.governanceVerdict === 'BLOCKED', 'BLOCKED plan governance is BLOCKED');
  assert(blockedPlan!.status === 'PROPOSED', 'BLOCKED plan was NOT auto-approved');

  // ALLOWED action plan: high priority score, approvable
  const allowedPlan = state.actionPlans.find((a) => a.governanceVerdict === 'ALLOWED');
  assert(allowedPlan !== undefined, 'ALLOWED action plan present');
  assert(allowedPlan!.priority === 'CRITICAL', 'ALLOWED plan retains CRITICAL raw priority');
  assert(allowedPlan!.governanceVerdict === 'ALLOWED', 'ALLOWED plan governance is ALLOWED');

  // Operating-state service does NOT mutate or recalculate priority scores
  const serviceSource = require('fs').readFileSync(
    require('path').resolve(__dirname, '../src/ai/executive/operating-state/service.ts'),
    'utf8'
  );
  // priorityScore appears only in orderBy (read-only sort), never in a write/update/create context
  assert(!serviceSource.includes('priorityScore ='), 'Operating-state service does not assign/mutate priorityScore');
  // Verify it's only used in orderBy, not in data creation
  const pScoreLines = serviceSource.split('\n').filter((l: string) => l.includes('priorityScore'));
  const allInOrderBy = pScoreLines.every((l: string) => l.includes('orderBy'));
  assert(allInOrderBy, 'priorityScore appears only in orderBy (read-only sort)');
  assert(!serviceSource.includes('PrioritizationEngine'), 'No PrioritizationEngine in operating-state synthesis');
}

async function test10_Phase28DecisionIntegration(): Promise<void> {
  console.log('\n--- 10. Phase 28 Decision Integration ---');

  const state = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);

  assert(state.activeDecisions.length >= 2, `Phase 28 decisions integrated (${state.activeDecisions.length})`);

  const marketing = state.activeDecisions.find((d) => d.domain === 'MARKETING');
  assert(marketing !== undefined, 'MARKETING decision from Phase 28 present');
  assert(marketing!.decisionType === 'STRATEGIC', 'Decision type preserved as STRATEGIC');

  const finance = state.activeDecisions.find((d) => d.domain === 'FINANCE');
  assert(finance !== undefined, 'FINANCE decision from Phase 28 present');
  assert(finance!.governanceVerdict === 'BLOCKED', 'FINANCE decision governance preserved as BLOCKED');
}

async function test11_Phase29LearningIntegration(): Promise<void> {
  console.log('\n--- 11. Phase 29 Learning Integration ---');

  const state = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);

  assert(state.recentLearningSignals.length >= 1, `Learning signals integrated (${state.recentLearningSignals.length})`);

  const revSignal = state.recentLearningSignals.find((s) => s.metric === 'revenueMTD');
  assert(revSignal !== undefined, 'Revenue learning signal from Phase 29 present');
  assert(revSignal!.varianceStatus === 'NEGATIVE', 'Learning signal variance status preserved');
  assert(revSignal!.effectiveness === 'UNDERPERFORMED', 'Learning signal effectiveness preserved');
  assert(revSignal!.hypothesisResult === 'REFUTED', 'Learning signal hypothesis result preserved');
}

async function test12_Phase30ForecastIntegration(): Promise<void> {
  console.log('\n--- 12. Phase 30 Forecast Integration ---');

  const state = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);

  assert(state.activeForecasts.length >= 1, `Forecasts integrated (${state.activeForecasts.length})`);

  const revForecast = state.activeForecasts.find((f) => f.metric === 'revenueMTD');
  assert(revForecast !== undefined, 'Revenue forecast from Phase 30 present');
  assert(revForecast!.currentValue === 42000, 'Forecast current value preserved (42000)');
  assert(revForecast!.forecastValue === 38000, 'Forecast value preserved (38000)');
  assert(revForecast!.direction === 'DECREASING', 'Forecast direction preserved');
  assert(revForecast!.confidence === 'MEDIUM', 'Forecast confidence preserved');
}

async function test13_Phase31ActionPlanIntegration(): Promise<void> {
  console.log('\n--- 13. Phase 31 Action Plan Integration ---');

  const state = await ExecutiveOperatingSystemService.getOperatingState(ORG_A_ID);

  assert(state.actionPlans.length >= 2, `Action plans integrated (${state.actionPlans.length})`);

  const revPlan = state.actionPlans.find((a) => a.actionType === 'INVESTIGATE_REVENUE_DROP');
  assert(revPlan !== undefined, 'INVESTIGATE_REVENUE_DROP from Phase 31 present');
  assert(revPlan!.priority === 'CRITICAL', 'Action plan priority preserved');
  assert(revPlan!.confidence === 'HIGH', 'Action plan confidence preserved');
  assert(revPlan!.governanceVerdict === 'ALLOWED', 'Action plan governance verdict preserved');
}

async function test14_NoNewPrismaModels(): Promise<void> {
  console.log('\n--- 14. No Duplicate Business Intelligence Engines ---');

  // Operating-state introduces no new Prisma models
  const schemaSource = require('fs').readFileSync(
    require('path').resolve(__dirname, '../prisma/schema.prisma'),
    'utf8'
  );
  assert(
    !schemaSource.includes('ExecutiveOperatingState'),
    'No ExecutiveOperatingState model in Prisma schema (dynamic synthesis only)'
  );
  assert(
    !schemaSource.includes('BusinessCommandLoop'),
    'No BusinessCommandLoop model in Prisma schema'
  );
  assert(
    !schemaSource.includes('OperatingStateSnapshot'),
    'No OperatingStateSnapshot model in Prisma schema'
  );
}

async function test15_CredentialSafety(): Promise<void> {
  console.log('\n--- 15. Credential Safety ---');

  const files = [
    '../src/ai/executive/operating-state/service.ts',
    '../src/ai/executive/operating-state/types.ts',
    '../src/app/api/executive/operating-state/route.ts',
  ];

  for (const file of files) {
    const source = require('fs').readFileSync(require('path').resolve(__dirname, file), 'utf8');
    assert(!source.includes('DATABASE_URL'), `${file} does not contain DATABASE_URL`);
    assert(!source.includes('DIRECT_URL'), `${file} does not contain DIRECT_URL`);
    assert(!source.includes('password'), `${file} does not contain password literals`);
    assert(!source.includes('secret'), `${file} does not contain secret literals`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function runPhase32Verification(): Promise<void> {
  console.log('==========================================================================');
  console.log('🎯 RUNNING PHASE 32: EXECUTIVE OPERATING SYSTEM & BUSINESS COMMAND LOOP');
  console.log('==========================================================================');

  try {
    await test1_DatabaseIdentityAndSafety();
    await setup();
    await test2_DeterministicOperatingState();
    await test3_ZeroAutonomousSideEffects();
    await test4_GovernanceAuthority();
    await test5_Phase28Authority();
    await test6_TenantIsolation();
    await test7_APISecurity();
    await test8_CrossPhaseTraceability();
    await test9_ExecutivePriorityIntegrity();
    await test10_Phase28DecisionIntegration();
    await test11_Phase29LearningIntegration();
    await test12_Phase30ForecastIntegration();
    await test13_Phase31ActionPlanIntegration();
    await test14_NoNewPrismaModels();
    await test15_CredentialSafety();

    console.log(`\n==========================================================================`);
    console.log(`🎉 PHASE 32 VERIFICATION COMPLETE: ${passCount}/${passCount + failCount} PASSED (${failCount} FAILED)`);
    console.log(`==========================================================================`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\n--- PHASE 32 VERIFICATION FAILED ---');
    console.error(err);
    process.exit(1);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

runPhase32Verification();
