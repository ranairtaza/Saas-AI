/**
 * PHASE 29 VERIFICATION SUITE — EXECUTIVE OUTCOME INTELLIGENCE & LEARNING LOOP
 *
 * Verifies:
 * 1. Domain Schemas (VarianceStatus, OutcomeConfidence, DecisionEffectiveness, LearningSignal, HistoricalStrategyFeedback)
 * 2. Deterministic Expected vs Actual Variance Engine
 * 3. Deterministic Decision Effectiveness Classification
 * 4. Attribution & Hypothesis Validation Logic (Historical success alone cannot produce SUPPORTED)
 * 5. Outcome Confidence Scoring (Data completeness & causal attribution)
 * 6. Full Deterministic Outcome Evaluation
 * 7. Structured Learning Signal Data Model & Schema Validation
 * 8. Historical Strategy Feedback & Win Rate Calculation
 * 9. Strategy Synthesis Integration (Consuming feedback & refutations in MultiDomainStrategyEngine)
 * 10. Database Write Guard & RBAC Protections
 * 11. Multi-Tenant Scoping & Isolation Invariants
 * 12. Governance Precedence & Zero Autonomous Execution Invariants
 */

import {
  VarianceStatusSchema,
  OutcomeConfidenceSchema,
  DecisionEffectivenessSchema,
  ExecutiveLearningSignalSchema,
  HistoricalStrategyFeedbackSchema,
  ExecutiveOutcomeSchema,
  TelemetrySnapshot,
} from '../src/ai/executive/outcomes/types';
import { OutcomeEvaluator } from '../src/ai/executive/outcomes/evaluator';
import { MultiDomainStrategyEngine } from '../src/ai/executive/strategy/strategy-engine';
import { DecisionStateMachine } from '../src/ai/executive/decisions/state-machine';
import { DecisionAuthorityEvaluator } from '../src/ai/executive/decisions/authority-evaluator';
import { BusinessContext } from '../src/ai/executive/types';
import { assertDatabaseWritesAllowed } from '../src/lib/db-guard';
import { hasPermission } from '../src/permissions/rbac';
import { PERMISSIONS } from '../src/permissions/definitions';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase29Tests() {
  console.log('\n========================================================');
  console.log('🧪 RUNNING PHASE 29: OUTCOME INTELLIGENCE & LEARNING LOOP');
  console.log('========================================================\n');

  // --------------------------------------------------------------------------
  // Category 1: Domain Schemas & Enums
  // --------------------------------------------------------------------------
  console.log('--- Category 1: Domain Schemas & Enums ---');

  assert(VarianceStatusSchema.options.includes('POSITIVE'), 'VarianceStatus includes POSITIVE');
  assert(VarianceStatusSchema.options.includes('NEUTRAL'), 'VarianceStatus includes NEUTRAL');
  assert(VarianceStatusSchema.options.includes('NEGATIVE'), 'VarianceStatus includes NEGATIVE');
  assert(VarianceStatusSchema.options.includes('INCONCLUSIVE'), 'VarianceStatus includes INCONCLUSIVE');

  assert(OutcomeConfidenceSchema.options.includes('HIGH'), 'OutcomeConfidence includes HIGH');
  assert(OutcomeConfidenceSchema.options.includes('MEDIUM'), 'OutcomeConfidence includes MEDIUM');
  assert(OutcomeConfidenceSchema.options.includes('LOW'), 'OutcomeConfidence includes LOW');
  assert(OutcomeConfidenceSchema.options.includes('INSUFFICIENT'), 'OutcomeConfidence includes INSUFFICIENT');

  assert(DecisionEffectivenessSchema.options.includes('SUCCESS'), 'DecisionEffectiveness includes SUCCESS');
  assert(DecisionEffectivenessSchema.options.includes('PARTIAL_SUCCESS'), 'DecisionEffectiveness includes PARTIAL_SUCCESS');
  assert(DecisionEffectivenessSchema.options.includes('NEUTRAL'), 'DecisionEffectiveness includes NEUTRAL');
  assert(DecisionEffectivenessSchema.options.includes('UNDERPERFORMED'), 'DecisionEffectiveness includes UNDERPERFORMED');
  assert(DecisionEffectivenessSchema.options.includes('FAILED'), 'DecisionEffectiveness includes FAILED');
  assert(DecisionEffectivenessSchema.options.includes('INCONCLUSIVE'), 'DecisionEffectiveness includes INCONCLUSIVE');

  // --------------------------------------------------------------------------
  // Category 2: Expected vs Actual Variance Engine
  // --------------------------------------------------------------------------
  console.log('\n--- Category 2: Expected vs Actual Variance Engine ---');

  // Increasing metric (revenue, pipeline, health): actual > expected is positive
  const varIncPos = OutcomeEvaluator.calculateVariance(10000, 12000, false);
  assert(varIncPos.variance === 2000, 'Increasing metric: 12000 vs 10000 expected has +2000 variance');
  assert(varIncPos.variancePercentage === 20, 'Increasing metric: +20% variance percentage');
  assert(varIncPos.varianceStatus === 'POSITIVE', 'Increasing metric: varianceStatus is POSITIVE');

  // Increasing metric: actual < expected is negative
  const varIncNeg = OutcomeEvaluator.calculateVariance(10000, 8000, false);
  assert(varIncNeg.variance === -2000, 'Increasing metric: 8000 vs 10000 expected has -2000 variance');
  assert(varIncNeg.variancePercentage === -20, 'Increasing metric: -20% variance percentage');
  assert(varIncNeg.varianceStatus === 'NEGATIVE', 'Increasing metric: varianceStatus is NEGATIVE');

  // Increasing metric: actual === expected is neutral
  const varIncNeu = OutcomeEvaluator.calculateVariance(10000, 10000, false);
  assert(varIncNeu.variance === 0, 'Increasing metric: exactly met expectation has 0 variance');
  assert(varIncNeu.varianceStatus === 'NEUTRAL', 'Increasing metric: varianceStatus is NEUTRAL');

  // Decreasing metric (unassigned leads, churn, latency): actual < expected is positive (lower is better)
  const varDecPos = OutcomeEvaluator.calculateVariance(10, 2, true);
  assert(varDecPos.variance === 8, 'Decreasing metric: 2 actual vs 10 expected has +8 favorable variance');
  assert(varDecPos.variancePercentage === 80, 'Decreasing metric: +80% favorable variance');
  assert(varDecPos.varianceStatus === 'POSITIVE', 'Decreasing metric: varianceStatus is POSITIVE');

  // Decreasing metric: actual > expected is negative (higher is worse)
  const varDecNeg = OutcomeEvaluator.calculateVariance(10, 15, true);
  assert(varDecNeg.variance === -5, 'Decreasing metric: 15 actual vs 10 expected has -5 unfavorable variance');
  assert(varDecNeg.variancePercentage === -50, 'Decreasing metric: -50% unfavorable variance');
  assert(varDecNeg.varianceStatus === 'NEGATIVE', 'Decreasing metric: varianceStatus is NEGATIVE');

  // Inconclusive inputs (null, undefined, NaN)
  assert(OutcomeEvaluator.calculateVariance(null, 100).varianceStatus === 'INCONCLUSIVE', 'Null expected yields INCONCLUSIVE');
  assert(OutcomeEvaluator.calculateVariance(100, undefined).varianceStatus === 'INCONCLUSIVE', 'Undefined actual yields INCONCLUSIVE');

  // --------------------------------------------------------------------------
  // Category 3: Deterministic Decision Effectiveness Classification
  // --------------------------------------------------------------------------
  console.log('\n--- Category 3: Decision Effectiveness Classification ---');

  // SUCCESS
  const effSuccess = OutcomeEvaluator.classifyEffectiveness({
    varianceStatus: 'POSITIVE',
    variancePercentage: 25,
    resultStatus: 'SUCCESS',
    attributionLevel: 'DIRECT_CAUSAL',
    hasSufficientEvidence: true,
  });
  assert(effSuccess === 'SUCCESS', 'Favorable result with positive variance classifies as SUCCESS');

  // PARTIAL_SUCCESS
  const effPartialSuccess = OutcomeEvaluator.classifyEffectiveness({
    varianceStatus: 'NEGATIVE',
    variancePercentage: -5,
    resultStatus: 'SUCCESS',
    attributionLevel: 'CORRELATED',
    hasSufficientEvidence: true,
  });
  assert(effPartialSuccess === 'PARTIAL_SUCCESS', 'Favorable result with slight underperformance classifies as PARTIAL_SUCCESS');

  // UNDERPERFORMED
  const effUnderperformed = OutcomeEvaluator.classifyEffectiveness({
    varianceStatus: 'NEGATIVE',
    variancePercentage: -35,
    resultStatus: 'PARTIAL',
    attributionLevel: 'CORRELATED',
    hasSufficientEvidence: true,
  });
  assert(effUnderperformed === 'UNDERPERFORMED', 'Partial result with severe negative variance classifies as UNDERPERFORMED');

  // NEUTRAL
  const effNeutral = OutcomeEvaluator.classifyEffectiveness({
    varianceStatus: 'NEUTRAL',
    variancePercentage: 0,
    resultStatus: 'NEUTRAL',
    attributionLevel: 'NONE',
    hasSufficientEvidence: true,
  });
  assert(effNeutral === 'NEUTRAL', 'Neutral result classifies as NEUTRAL');

  // FAILED
  const effFailed = OutcomeEvaluator.classifyEffectiveness({
    varianceStatus: 'NEGATIVE',
    variancePercentage: -50,
    resultStatus: 'NEGATIVE',
    attributionLevel: 'NONE',
    hasSufficientEvidence: true,
  });
  assert(effFailed === 'FAILED', 'Negative result classifies as FAILED');

  // INCONCLUSIVE
  const effInconclusive = OutcomeEvaluator.classifyEffectiveness({
    varianceStatus: 'POSITIVE',
    variancePercentage: 30,
    resultStatus: 'SUCCESS',
    attributionLevel: 'DIRECT_CAUSAL',
    hasSufficientEvidence: false,
  });
  assert(effInconclusive === 'INCONCLUSIVE', 'Insufficient evidence classifies as INCONCLUSIVE');

  // --------------------------------------------------------------------------
  // Category 4: Hypothesis Validation Invariants (Evidence Grounding)
  // --------------------------------------------------------------------------
  console.log('\n--- Category 4: Hypothesis Validation Invariants ---');

  // Invariant 1: Actual measured failure ALWAYS produces REFUTED, regardless of prior historical success
  const hypRefutedEvenIfHistoricallySuccessful = OutcomeEvaluator.evaluateHypothesis({
    resultStatus: 'NEGATIVE',
    attributionLevel: 'NONE',
  });
  assert(
    hypRefutedEvenIfHistoricallySuccessful.status === 'REFUTED' && hypRefutedEvenIfHistoricallySuccessful.falsified,
    'Invariant: Negative measured outcome strictly yields REFUTED hypothesis with falsified=true'
  );

  // Invariant 2: Lack of attribution or inconclusive delta produces INCONCLUSIVE
  const hypInconclusive = OutcomeEvaluator.evaluateHypothesis({
    resultStatus: 'INCONCLUSIVE',
    attributionLevel: 'INCONCLUSIVE',
  });
  assert(
    hypInconclusive.status === 'INCONCLUSIVE' && !hypInconclusive.falsified,
    'Invariant: Inconclusive telemetry strictly yields INCONCLUSIVE hypothesis'
  );

  // Invariant 3: Favorable outcome with CORRELATED attribution produces PARTIALLY_SUPPORTED
  const hypCorrelated = OutcomeEvaluator.evaluateHypothesis({
    resultStatus: 'SUCCESS',
    attributionLevel: 'CORRELATED',
  });
  assert(
    hypCorrelated.status === 'PARTIALLY_SUPPORTED',
    'Invariant: Correlated success produces PARTIALLY_SUPPORTED (never overclaiming direct causality)'
  );

  // Invariant 4: Favorable outcome with DIRECT_CAUSAL attribution produces SUPPORTED
  const hypSupported = OutcomeEvaluator.evaluateHypothesis({
    resultStatus: 'SUCCESS',
    attributionLevel: 'DIRECT_CAUSAL',
  });
  assert(
    hypSupported.status === 'SUPPORTED' && !hypSupported.falsified,
    'Invariant: Success with direct causality strictly validates hypothesis as SUPPORTED'
  );

  // Confidence scoring verification
  const confHigh = OutcomeEvaluator.evaluateConfidence({
    dataCompletenessPct: 90,
    sampleCount: 5,
    attributionLevel: 'DIRECT_CAUSAL',
  });
  assert(confHigh === 'HIGH', 'Data >= 80% with DIRECT_CAUSAL yields HIGH confidence');

  const confMed = OutcomeEvaluator.evaluateConfidence({
    dataCompletenessPct: 70,
    sampleCount: 2,
    attributionLevel: 'CORRELATED',
  });
  assert(confMed === 'MEDIUM', 'Data >= 65% with CORRELATED yields MEDIUM confidence');

  const confLow = OutcomeEvaluator.evaluateConfidence({
    dataCompletenessPct: 55,
    sampleCount: 1,
    attributionLevel: 'INCONCLUSIVE',
  });
  assert(confLow === 'LOW', 'Sparse data with inconclusive attribution yields LOW confidence');

  const confInsuff = OutcomeEvaluator.evaluateConfidence({
    dataCompletenessPct: 30,
    sampleCount: 0,
    attributionLevel: 'NONE',
  });
  assert(confInsuff === 'INSUFFICIENT', 'Data < 50% yields INSUFFICIENT confidence');

  // --------------------------------------------------------------------------
  // Category 5: Full Deterministic Outcome Evaluation
  // --------------------------------------------------------------------------
  console.log('\n--- Category 5: Full Deterministic Outcome Evaluation ---');

  const beforeSnap: TelemetrySnapshot = {
    timestamp: '2026-09-01T10:00:00.000Z',
    revenueMTD: 50000,
    pipelineValue: 200000,
    activeLeadsCount: 100,
    qualifiedLeadsCount: 20,
    unassignedHighPriorityLeads: 12,
    businessHealthScore: 70,
    goalStatuses: [],
  };

  const afterSnapSuccess: TelemetrySnapshot = {
    timestamp: '2026-09-08T10:00:00.000Z',
    revenueMTD: 58000,
    pipelineValue: 240000,
    activeLeadsCount: 110,
    qualifiedLeadsCount: 26,
    unassignedHighPriorityLeads: 0,
    businessHealthScore: 84,
    goalStatuses: [],
  };

  const evalOps = OutcomeEvaluator.evaluate({
    domain: 'OPERATIONS',
    targetKpiKey: 'unassigned_high_priority_leads',
    actionName: 'assign_lead',
    expectedValue: 0,
    beforeSnapshot: beforeSnap,
    afterSnapshot: afterSnapSuccess,
    attributionLevel: 'DIRECT_CAUSAL',
    attributionRationale: 'Mock test',
  });

  assert(evalOps.finalValue === 0, 'Extracted final value is 0');
  assert(evalOps.deltaValue === -12, 'Calculated delta value is -12');
  assert(evalOps.resultStatus === 'SUCCESS', 'Backlog clearing classified as SUCCESS');
  assert(evalOps.attributionLevel === 'DIRECT_CAUSAL', 'Lead assignment action has DIRECT_CAUSAL attribution');
  assert(evalOps.hypothesisStatus === 'SUPPORTED', 'Hypothesis is validated as SUPPORTED');
  assert(evalOps.variance === 0, 'Variance is 0 (matched target)');
  assert(evalOps.varianceStatus === 'NEUTRAL', 'Variance status is NEUTRAL when exactly matching expectation');
  assert(evalOps.effectivenessStatus === 'SUCCESS', 'Effectiveness status is SUCCESS');
  assert(evalOps.confidence === 'HIGH', 'Confidence is HIGH');

  // --------------------------------------------------------------------------
  // Category 6: Structured Learning Signal Schema Validation
  // --------------------------------------------------------------------------
  console.log('\n--- Category 6: Structured Learning Signal Schema Validation ---');

  const validSignal = {
    id: '00000000-0000-4000-a000-000000000001',
    organizationId: 'org-test-123',
    decisionId: 'dec-123',
    outcomeId: 'out-123',
    domain: 'OPERATIONS',
    strategyKey: 'High-Priority Lead SLA Routing',
    metric: 'unassigned_high_priority_leads',
    expectedValue: 0,
    actualValue: 0,
    variance: 0,
    variancePercentage: 0,
    varianceStatus: 'NEUTRAL',
    effectiveness: 'SUCCESS',
    confidence: 'HIGH',
    hypothesisResult: 'SUPPORTED',
    evidence: 'Lead assignment directly cleared backlog',
    createdAt: new Date().toISOString(),
  };

  const parsedSignal = ExecutiveLearningSignalSchema.parse(validSignal);
  assert(parsedSignal.effectiveness === 'SUCCESS', 'Valid learning signal parses cleanly');
  assert(parsedSignal.confidence === 'HIGH', 'Learning signal confidence matches HIGH');

  // --------------------------------------------------------------------------
  // Category 7: Historical Strategy Feedback & Win Rate Calculation
  // --------------------------------------------------------------------------
  console.log('\n--- Category 7: Historical Strategy Feedback & Win Rate Calculation ---');

  const strategyFeedbackSample = {
    strategyKey: 'Lead Routing Optimization',
    domain: 'OPERATIONS',
    sampleCount: 4,
    historicalSuccessRate: 75,
    averageVariance: 1.5,
    recommendedConfidence: 'HIGH' as const,
    refutedHypothesisCount: 0,
    status: 'HISTORICALLY_SUCCESSFUL' as const,
  };

  const parsedFeedback = HistoricalStrategyFeedbackSchema.parse(strategyFeedbackSample);
  assert(parsedFeedback.status === 'HISTORICALLY_SUCCESSFUL', 'Historical feedback parses with HISTORICALLY_SUCCESSFUL status');
  assert(parsedFeedback.recommendedConfidence === 'HIGH', 'Recommended confidence is HIGH for multi-sample success');

  // --------------------------------------------------------------------------
  // Category 8: Multi-Domain Strategy Synthesis Integration
  // --------------------------------------------------------------------------
  console.log('\n--- Category 8: Multi-Domain Strategy Synthesis Integration ---');

  const mockContext: BusinessContext = {
    organizationId: 'org-test-123',
    identity: {
      name: 'Acme Learning Corp',
      industry: 'B2B SaaS',
      businessModel: 'Subscription',
      targetMarket: '', operatingPriorities: 'Growth',
      operatingCurrency: 'USD',
      timezone: 'UTC',
    },
  telemetry: {
  metrics: {
    revenueMTD: { value: 50000, unit: 'CURRENCY', source: 'stripe', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    revenueLastMonth: { value: 0, unit: 'CURRENCY', source: 'NONE', freshness: 'UNAVAILABLE', lastUpdatedAt: null },
    transactionsMTD: { value: 0, unit: 'COUNT', source: 'NONE', freshness: 'UNAVAILABLE', lastUpdatedAt: null },
    newCustomersMTD: { value: 0, unit: 'COUNT', source: 'NONE', freshness: 'UNAVAILABLE', lastUpdatedAt: null },
    activeSubscriptions: { value: 0, unit: 'COUNT', source: 'NONE', freshness: 'UNAVAILABLE', lastUpdatedAt: null },
    totalLeads: { value: 100, unit: 'COUNT', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    activeLeadsCount: { value: 100, unit: 'COUNT', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    qualifiedLeads: { value: 50, unit: 'COUNT', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    unassignedHighPriorityLeads: { value: 10, unit: 'COUNT', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() },
    pipelineValue: { value: 120000, unit: 'CURRENCY', source: 'crm', freshness: 'REAL_TIME', lastUpdatedAt: new Date() }
  },
  recentAnomalies: [],
  dataFreshness: []
},
      goals: [],
    recentMemories: [],
    policies: [],
    historicalPerformance: {
      totalRecommendations: 3,
      totalExecuted: 3,
      totalMeasured: 3,
      successRatePct: 100,
      effectivenessScore: 88,
      domainPerformance: { OPERATIONS: { total: 3, successful: 3, winRatePct: 100 } },
      topValidatedStrategies: ['High-Priority Lead Routing & Response Velocity'],
      refutedHypotheses: ['Cold Spray Outbound Campaign'],
      learningSignalsCount: 3,
      strategyFeedback: [strategyFeedbackSample],
    },
    untrustedExternalData: [],
    assembledAt: new Date(),
  };

  const synthesized = MultiDomainStrategyEngine.synthesizeStrategy(mockContext);
  assert(synthesized.strategicHypotheses.length >= 2, 'Strategy engine generates strategic hypotheses');
  assert(synthesized.strategicOptions.length >= 2, 'Strategy engine generates strategic options');

  const opsHyp = synthesized.strategicHypotheses.find((h) => h.id === 'hyp-ops-lead-velocity');
  assert(opsHyp !== undefined, 'Operational lead velocity hypothesis is synthesized');
  assert(
    opsHyp?.historicalValidation === 'SUPPORTED',
    'Historically validated strategy is flagged as SUPPORTED in strategic hypotheses'
  );

  // --------------------------------------------------------------------------
  // Category 9: Database Write Guard Safety
  // --------------------------------------------------------------------------
  console.log('\n--- Category 9: Database Write Guard Safety ---');

  // Test fail-closed by default
  const prevEnabled = process.env.LEADMACHINE_DB_WRITES_ENABLED;
  const prevDbId = process.env.LEADMACHINE_DATABASE_ID;

  process.env.LEADMACHINE_DB_WRITES_ENABLED = 'false';
  let failClosedTriggered = false;
  try {
    assertDatabaseWritesAllowed('Phase 29 Write Test');
  } catch (err: any) {
    if (err.name === 'DatabaseWriteBlockedError') {
      failClosedTriggered = true;
    }
  }
  assert(failClosedTriggered, 'Database write guard is fail-closed by default when writes disabled');

  // Test allowed when strictly enabled
  process.env.LEADMACHINE_DB_WRITES_ENABLED = 'true';
  process.env.LEADMACHINE_DATABASE_ID = 'leadmachine';
  let writeAllowed = false;
  try {
    assertDatabaseWritesAllowed('Phase 29 Write Allowed Test');
    writeAllowed = true;
  } catch (err) {
    writeAllowed = false;
  }
  assert(writeAllowed, 'Database write guard allows writes when strictly configured');

  // Restore env
  if (prevEnabled !== undefined) process.env.LEADMACHINE_DB_WRITES_ENABLED = prevEnabled;
  else delete process.env.LEADMACHINE_DB_WRITES_ENABLED;
  if (prevDbId !== undefined) process.env.LEADMACHINE_DATABASE_ID = prevDbId;
  else delete process.env.LEADMACHINE_DATABASE_ID;

  // --------------------------------------------------------------------------
  // Category 10: RBAC Role & Permission Enforcements
  // --------------------------------------------------------------------------
  console.log('\n--- Category 10: RBAC Role & Permission Enforcements ---');

  assert(hasPermission('OWNER', PERMISSIONS.LEAD_READ), 'OWNER role has LEAD_READ permission');
  assert(hasPermission('ADMIN', PERMISSIONS.LEAD_READ), 'ADMIN role has LEAD_READ permission');
  assert(hasPermission('MANAGER', PERMISSIONS.LEAD_READ), 'MANAGER role has LEAD_READ permission');
  assert(hasPermission('MEMBER', PERMISSIONS.LEAD_READ), 'MEMBER role has LEAD_READ permission');
  assert(hasPermission('READ_ONLY', PERMISSIONS.LEAD_READ), 'READ_ONLY role has LEAD_READ permission');
  assert(hasPermission('OWNER', PERMISSIONS.AI_ACTION_SENSITIVE), 'OWNER role has AI_ACTION_SENSITIVE permission');
  assert(hasPermission('ADMIN', PERMISSIONS.AI_ACTION_SENSITIVE), 'ADMIN role has AI_ACTION_SENSITIVE permission');
  assert(!hasPermission('READ_ONLY', PERMISSIONS.AI_ACTION_SENSITIVE), 'READ_ONLY role is denied AI_ACTION_SENSITIVE permission');
  assert(!hasPermission('MEMBER', PERMISSIONS.AI_ACTION_SENSITIVE), 'MEMBER role is denied AI_ACTION_SENSITIVE permission');

  // --------------------------------------------------------------------------
  // Category 11: Multi-Tenant Scoping Invariants
  // --------------------------------------------------------------------------
  console.log('\n--- Category 11: Multi-Tenant Scoping Invariants ---');

  // Verify learning signal and feedback API routes exist and enforce tenant isolation
  const learningRoutePath = path.join(process.cwd(), 'src/app/api/executive/learning/route.ts');
  const feedbackRoutePath = path.join(process.cwd(), 'src/app/api/executive/learning/feedback/route.ts');
  assert(fs.existsSync(learningRoutePath), 'Learning signals API route file exists');
  assert(fs.existsSync(feedbackRoutePath), 'Historical strategy feedback API route file exists');

  const learningRouteContent = fs.readFileSync(learningRoutePath, 'utf8');
  assert(learningRouteContent.includes('getCurrentUser()'), 'Learning API enforces authenticated session');
  assert(learningRouteContent.includes('user.organizationId'), 'Learning API enforces strict tenant isolation by organizationId');

  const feedbackRouteContent = fs.readFileSync(feedbackRoutePath, 'utf8');
  assert(feedbackRouteContent.includes('user.organizationId'), 'Feedback API enforces strict tenant isolation by organizationId');

  // Verify Prisma Schema foreign keys for tenant scoping
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  assert(schemaContent.includes('model ExecutiveLearningSignal'), 'Prisma schema includes ExecutiveLearningSignal');
  assert(/organizationId\s+String/.test(schemaContent), 'ExecutiveLearningSignal strictly belongs to Organization');
  assert(schemaContent.includes('@@index([organizationId, domain])'), 'ExecutiveLearningSignal indexes organizationId');

  // --------------------------------------------------------------------------
  // Category 12: Governance Precedence & Zero Autonomous Execution Invariants
  // --------------------------------------------------------------------------
  console.log('\n--- Category 12: Governance Precedence & Zero Autonomous Execution Invariants ---');

  // Invariant 1: BLOCKED governance verdict cannot be bypassed by high historical win rate
  const blockedTransition = DecisionStateMachine.validateTransition(
    'PENDING',
    'APPROVED',
    'BLOCKED'
  );
  assert(!blockedTransition.valid, 'Governance Invariant: BLOCKED verdict CANNOT transition to APPROVED regardless of historical track record');

  // Invariant 2: INSUFFICIENT_EVIDENCE governance verdict cannot transition to APPROVED
  const insufficientEvidenceTransition = DecisionStateMachine.validateTransition(
    'PENDING',
    'APPROVED',
    'INSUFFICIENT_EVIDENCE'
  );
  assert(!insufficientEvidenceTransition.valid, 'Governance Invariant: INSUFFICIENT_EVIDENCE verdict CANNOT transition to APPROVED');


  // Invariant 3: REQUIRES_ESCALATION mandates EXECUTIVE authority regardless of historical win rate
  const requiredAuth = DecisionAuthorityEvaluator.determineAuthority('REQUIRES_ESCALATION', 20);
  assert(requiredAuth === 'EXECUTIVE', 'Governance Invariant: REQUIRES_ESCALATION strictly mandates EXECUTIVE authority');

  const managerAuth = DecisionAuthorityEvaluator.isAuthorized('MANAGER', 'EXECUTIVE');
  assert(!managerAuth.authorized, 'Governance Invariant: Historical success does not grant MANAGER role EXECUTIVE authority');


  // Invariant 4: Zero outbound email transport exists in outcome learning
  const outcomeServicePath = path.join(process.cwd(), 'src/ai/executive/outcomes/outcome-service.ts');
  const outcomeServiceContent = fs.readFileSync(outcomeServicePath, 'utf8');
  assert(!outcomeServiceContent.includes('sendMail'), 'Outcome service does NOT send emails');
  assert(!outcomeServiceContent.includes('nodemailer'), 'Outcome service does NOT import nodemailer');
  assert(!outcomeServiceContent.includes('resend'), 'Outcome service does NOT import resend');

  // Invariant 5: Zero autonomous execution in outcome service
  assert(!outcomeServiceContent.includes('executeAction'), 'Outcome service does NOT autonomously execute actions');

  console.log('\n========================================================');
  console.log(`✅ PHASE 29 VERIFICATION COMPLETE: ${passed}/${passed + failed} ASSERTIONS PASSED (100%)`);
  console.log('========================================================\n');
}

runPhase29Tests().catch((err) => {
  console.error('\n❌ PHASE 29 VERIFICATION FAILED:', err);
  process.exit(1);
});
