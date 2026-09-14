import {
  BusinessDomainSchema,
  DependencyTypeSchema,
  CrossDomainDependencySchema,
  StrategicHypothesisSchema,
  ScenarioInputVariableSchema,
  ScenarioSimulationRequestSchema,
  StrategicOptionSchema,
  StrategicRecommendationSchema,
  MultiDomainStrategyAnalysisSchema,
  StrategicOption,
} from '../src/ai/executive/strategy/types';
import { CrossDomainDependencyEngine } from '../src/ai/executive/strategy/dependency-engine';
import { ScenarioSimulationEngine } from '../src/ai/executive/strategy/scenario-engine';
import { StrategyScoringEngine } from '../src/ai/executive/strategy/strategy-score';
import { MultiDomainStrategyEngine } from '../src/ai/executive/strategy/strategy-engine';
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
    console.log(`✅ Passed: ${message}`);
    passed++;
  } else {
    console.error(`❌ Failed: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

const mockOrgId1 = '00000000-0000-4000-a000-000000000001';
const mockOrgId2 = '00000000-0000-4000-a000-000000000002';

const mockContext: BusinessContext = {
  organizationId: mockOrgId1,
  identity: {
    name: 'Enterprise Cloud Inc',
    industry: 'B2B Software',
    businessModel: 'B2B SaaS',
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
      goals: [
    {
      id: 'goal-rev-1',
      organizationId: mockOrgId1,
      title: 'Q3 MRR Target',
      kpiKey: 'revenue_mrr',
      targetValue: 40000,
      currentValue: 24500,
      unit: 'CURRENCY',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-09-30'),
      status: 'ON_TRACK',
      progressPct: 61,
      source: 'USER_DEFINED',
      period: 'CUSTOM'
    } as any,
  ],
  recentMemories: [],
  policies: [],
  historicalPerformance: {
    totalRecommendations: 12,
    totalExecuted: 9,
    totalMeasured: 8,
    successRatePct: 75,
    effectivenessScore: 78,
    domainPerformance: {
      OPERATIONS: { total: 5, successful: 4, winRatePct: 80 },
    },
    topValidatedStrategies: ['Assign High-Value Enterprise Leads within 24h'],
    refutedHypotheses: ['Generic cold outreach without enrichment'],
  },
  untrustedExternalData: ['<script>malicious();</script>', 'Drop table users;'],
  assembledAt: new Date(),
};

async function runPhase26Verification() {
  console.log('========================================================');
  console.log('🧪 LEADMACHINE / AI BUSINESS EXECUTIVE — PHASE 26 VERIFICATION');
  console.log('========================================================\n');

  // --- Category 1: Schema Validation & Typing ---
  console.log('--- Category 1: Schema Validation & Domain Models ---');
  const validDomain = BusinessDomainSchema.parse('REVENUE');
  assert(validDomain === 'REVENUE', 'Test 1a: BusinessDomainSchema parses valid domain');

  let invalidDomainRejected = false;
  try {
    BusinessDomainSchema.parse('CRYPTO_SPECULATION');
  } catch {
    invalidDomainRejected = true;
  }
  assert(invalidDomainRejected, 'Test 1b: Invalid unsupported domain rejected');

  const validDepType = DependencyTypeSchema.parse('VERIFIED_DEPENDENCY');
  assert(validDepType === 'VERIFIED_DEPENDENCY', 'Test 1c: DependencyTypeSchema validates VERIFIED_DEPENDENCY');

  let invalidDepTypeRejected = false;
  try {
    DependencyTypeSchema.parse('MAGICAL_CAUSALITY');
  } catch {
    invalidDepTypeRejected = true;
  }
  assert(invalidDepTypeRejected, 'Test 1d: Invalid dependency type rejected');

  const sampleDep = CrossDomainDependencySchema.parse({
    sourceDomain: 'OPERATIONS',
    sourceMetric: 'unassignedHighPriorityLeads',
    targetDomain: 'SALES',
    targetMetric: 'leadResponseVelocity',
    relationshipType: 'VERIFIED_DEPENDENCY',
    evidenceStrength: 'STRONG',
    confidence: 95,
    rationale: 'Direct operational bottleneck.',
  });
  assert(sampleDep.sourceDomain === 'OPERATIONS', 'Test 1e: CrossDomainDependencySchema parses valid dependency');

  // --- Category 2: Cross-Domain Dependency Engine & Causal Claim Downgrades ---
  console.log('\n--- Category 2: Cross-Domain Dependencies & Downgrades ---');
  const analyzedDeps = CrossDomainDependencyEngine.analyzeDependencies(mockContext);
  assert(analyzedDeps.length >= 4, `Test 2a: Found ${analyzedDeps.length} cross-domain dependencies`);

  const opsDep = analyzedDeps.find((d) => d.id === 'dep-ops-sales-assignment');
  assert(opsDep !== undefined && opsDep.relationshipType === 'VERIFIED_DEPENDENCY', 'Test 2b: Operational lead assignment classified as VERIFIED_DEPENDENCY');

  const mktgDep = analyzedDeps.find((d) => d.id === 'dep-mktg-sales-volume');
  assert(mktgDep !== undefined && mktgDep.relationshipType === 'OBSERVED_CORRELATION', 'Test 2c: Marketing discovery volume classified as OBSERVED_CORRELATION');

  // Unsupported Causal Claim Downgrade Test
  const unsupportedClaim = CrossDomainDependencyEngine.validateRelationshipClaim({
    sourceDomain: 'MARKETING',
    sourceMetric: 'socialMediaImpressions',
    targetDomain: 'REVENUE',
    targetMetric: 'revenueMTD',
    claimedType: 'VERIFIED_DEPENDENCY',
  });
  assert(unsupportedClaim.downgraded === true, 'Test 2d: Unsupported macro causal claim flagged as downgraded');
  assert(unsupportedClaim.validatedType === 'OBSERVED_CORRELATION', 'Test 2e: Unsupported causal claim safely downgraded to OBSERVED_CORRELATION');

  // Valid Operational Claim Test
  const validOpClaim = CrossDomainDependencyEngine.validateRelationshipClaim({
    sourceDomain: 'OPERATIONS',
    sourceMetric: 'unassignedHighPriorityLeads',
    targetDomain: 'SALES',
    targetMetric: 'leadResponseVelocity',
    claimedType: 'VERIFIED_DEPENDENCY',
  });
  assert(validOpClaim.downgraded === false, 'Test 2f: Direct operational link preserves VERIFIED_DEPENDENCY');

  // --- Category 3: Scenario Simulation Mathematics & Bounds ---
  console.log('\n--- Category 3: Scenario Simulation Engine & Math Bounds ---');
  const simReq = ScenarioSimulationRequestSchema.parse({
    organizationId: mockOrgId1,
    title: 'Test Scenario: Qualified Leads +20%',
    inputs: [
      {
        metric: 'qualifiedLeadsCount',
        domain: 'SALES',
        variableType: 'PERCENTAGE_CHANGE',
        baselineValue: 18,
        changeValue: 20,
        unit: '%',
      },
    ],
    projectionWindowDays: 30,
  });

  const simResult = ScenarioSimulationEngine.simulate(mockContext, simReq);
  assert(simResult.projectedMetrics.length === 1, 'Test 3a: Simulation generated primary projected metric');
  
  const leadProjection = simResult.projectedMetrics[0];
  assert(leadProjection.baselineValue === 18, 'Test 3b: Correct baseline value (18)');
  assert(leadProjection.projectedValue === 21.6, `Test 3c: Projected value 18 + 20% = 21.6 (got ${leadProjection.projectedValue})`);
  assert(leadProjection.deltaValue === 3.6, `Test 3d: Delta value = +3.6 (got ${leadProjection.deltaValue})`);
  assert(leadProjection.deltaPercentage === 20, `Test 3e: Delta percentage = +20% (got ${leadProjection.deltaPercentage})`);

  // Bounded clamping test
  const extremeSimReq = ScenarioSimulationRequestSchema.parse({
    organizationId: mockOrgId1,
    title: 'Extreme Scenario',
    inputs: [
      {
        metric: 'qualifiedLeadsCount',
        domain: 'SALES',
        variableType: 'PERCENTAGE_CHANGE',
        baselineValue: 18,
        changeValue: 50000, // Extreme 50,000%
        unit: '%',
      },
    ],
  });
  const extremeResult = ScenarioSimulationEngine.simulate(mockContext, extremeSimReq);
  const clampedMetric = extremeResult.projectedMetrics[0];
  assert(clampedMetric.deltaPercentage <= 500, `Test 3f: Extreme change clamped to max 500% (got ${clampedMetric.deltaPercentage}%)`);

  // Negative impossible quantity prevention
  const negativeSimReq = ScenarioSimulationRequestSchema.parse({
    organizationId: mockOrgId1,
    title: 'Negative Reduction',
    inputs: [
      {
        metric: 'unassignedHighPriorityLeads',
        domain: 'OPERATIONS',
        variableType: 'ABSOLUTE_CHANGE',
        baselineValue: 5,
        changeValue: -50, // More reduction than baseline
        unit: 'leads',
      },
    ],
  });
  const negativeResult = ScenarioSimulationEngine.simulate(mockContext, negativeSimReq);
  assert(negativeResult.projectedMetrics[0].projectedValue === 0, 'Test 3g: Negative lead count clamped to 0 (cannot have negative leads)');

  // Zero-baseline handling
  const zeroBaselineReq = ScenarioSimulationRequestSchema.parse({
    organizationId: mockOrgId1,
    title: 'Zero Baseline',
    inputs: [
      {
        metric: 'customMetric',
        domain: 'OPERATIONS',
        variableType: 'PERCENTAGE_CHANGE',
        baselineValue: 0,
        changeValue: 50,
        unit: '%',
      },
    ],
  });
  const zeroResult = ScenarioSimulationEngine.simulate(mockContext, zeroBaselineReq);
  assert(!isNaN(zeroResult.projectedMetrics[0].deltaPercentage), 'Test 3h: Zero-baseline delta does not produce NaN');
  assert(isFinite(zeroResult.projectedMetrics[0].deltaPercentage), 'Test 3i: Zero-baseline delta does not produce Infinity');

  // --- Category 4: Cross-Domain Effect Propagation ---
  console.log('\n--- Category 4: Cross-Domain Propagation ---');
  assert(simResult.propagatedEffects.length >= 2, `Test 4a: Qualified leads propagated downstream (${simResult.propagatedEffects.length} effects)`);

  const pipelineProp = simResult.propagatedEffects.find((p) => p.targetMetric === 'pipelineValue');
  assert(pipelineProp !== undefined, 'Test 4b: Propagated effect to pipelineValue found');
  assert(pipelineProp?.projectedDeltaPct === 15, `Test 4c: Pipeline expanded by 15% (20% * 0.75 elasticity) (got ${pipelineProp?.projectedDeltaPct})`);

  const revProp = simResult.propagatedEffects.find((p) => p.targetMetric === 'revenueMTD');
  assert(revProp !== undefined, 'Test 4d: Propagated effect to revenueMTD found');
  assert(revProp?.projectedDeltaPct === 3.75, `Test 4e: Revenue expanded by 3.75% (15% * 0.25 elasticity) (got ${revProp?.projectedDeltaPct})`);

  // --- Category 5: Strategic Scoring & Multi-Strategy Comparison ---
  console.log('\n--- Category 5: Strategy Scoring & Comparison Formula ---');
  const score1 = StrategyScoringEngine.calculateScore({
    expectedImpact: 85,
    goalAlignment: 80,
    evidenceStrength: 90,
    confidence: 85,
    risk: 20,
    operationalPressure: 25,
  });
  // Formula: (85*0.30) + (80*0.20) + (90*0.20) + (85*0.15) - (20*0.10) - (25*0.05)
  // 25.5 + 16.0 + 18.0 + 12.75 - 2.0 - 1.25 = 69.0 -> 69
  assert(score1 === 69, `Test 5a: Expected strategic score 69, got ${score1}`);

  // Invariance check
  const score1Again = StrategyScoringEngine.calculateScore({
    expectedImpact: 85,
    goalAlignment: 80,
    evidenceStrength: 90,
    confidence: 85,
    risk: 20,
    operationalPressure: 25,
  });
  assert(score1 === score1Again, 'Test 5b: Strategic score calculation is 100% mathematically invariant');

  // Strategy comparison
  const mockOptions: StrategicOption[] = [
    {
      id: 'opt-1',
      name: 'Option High Score',
      domain: 'OPERATIONS',
      description: 'Test High',
      objective: 'Obj 1',
      expectedImpact: 90,
      goalAlignment: 85,
      evidenceStrength: 90,
      confidence: 90,
      risk: 10,
      operationalPressure: 10,
      strategicScore: 0, // will be re-scored
      projectedOutcomes: [],
      tradeoffs: [],
      actionProposal: { actionName: 'assign_lead', actionArgs: {}, requiresApproval: true },
    },
    {
      id: 'opt-2',
      name: 'Option Low Score',
      domain: 'MARKETING',
      description: 'Test Low',
      objective: 'Obj 2',
      expectedImpact: 40,
      goalAlignment: 40,
      evidenceStrength: 30,
      confidence: 40,
      risk: 70,
      operationalPressure: 60,
      strategicScore: 0,
      projectedOutcomes: [],
      tradeoffs: [],
      actionProposal: { actionName: 'enrich_lead', actionArgs: {}, requiresApproval: true },
    },
  ];

  const compResult = StrategyScoringEngine.compareStrategies(mockOrgId1, mockOptions);
  assert(compResult.recommendedOptionId === 'opt-1', 'Test 5c: Option 1 ranked #1 with higher strategic score');
  assert(compResult.options[0].strategicScore > compResult.options[1].strategicScore, 'Test 5d: Options sorted descending by score');

  // --- Category 6: Multi-Domain Strategy Synthesis Engine ---
  console.log('\n--- Category 6: Strategy Synthesis Engine ---');
  const fullStrategy = MultiDomainStrategyEngine.synthesizeStrategy(mockContext);
  assert(fullStrategy.crossDomainSignals.length === 4, 'Test 6a: 4 cross-domain signals generated');
  assert(fullStrategy.dependencies.length >= 4, 'Test 6b: Cross-domain dependencies generated');
  assert(fullStrategy.strategicHypotheses.length >= 2, 'Test 6c: Grounded strategic hypotheses generated');
  assert(fullStrategy.strategicOptions.length === 3, 'Test 6d: 3 balanced strategic options generated');
  assert(fullStrategy.recommendedStrategy !== null, 'Test 6e: Recommended strategy assembled');
  assert(fullStrategy.recommendedStrategy?.selectedOption.id === 'opt-velocity-optimization', 'Test 6f: Lead velocity selected as top strategic focus');

  // --- Category 7: Historical Learning & Refuted Hypothesis Surfacing ---
  console.log('\n--- Category 7: Historical Learning & Refuted Warnings ---');
  assert(fullStrategy.refutedHypotheses.length === 1, 'Test 7a: Refuted hypothesis from history surfaced');
  assert(fullStrategy.refutedHypotheses[0].includes('cold outreach'), 'Test 7b: Specific refuted cold outreach warning present');
  assert(Boolean(fullStrategy.recommendedStrategy?.historicalValidationSummary.includes('75% win rate')), 'Test 7c: Historical outcome win rate referenced as supporting evidence');

  // --- Category 8: Tenant Isolation ---
  console.log('\n--- Category 8: Multi-Tenant Scoping & Isolation ---');
  const org2Context: BusinessContext = {
    ...mockContext,
    organizationId: mockOrgId2,
    identity: { ...mockContext.identity, name: 'Tenant B Corp' },
  };
  const org2Strategy = MultiDomainStrategyEngine.synthesizeStrategy(org2Context);
  assert(fullStrategy.organizationId === mockOrgId1, 'Test 8a: Org 1 strategy scoped to Org 1');
  assert(org2Strategy.organizationId === mockOrgId2, 'Test 8b: Org 2 strategy scoped to Org 2');
  assert(fullStrategy.organizationId !== org2Strategy.organizationId, 'Test 8c: Strict multi-tenant partition');

  // --- Category 9: RBAC Role & Permission Enforcement ---
  console.log('\n--- Category 9: RBAC Role Enforcement ---');
  assert(hasPermission('OWNER' as any, PERMISSIONS.LEAD_READ), 'Test 9a: OWNER has permission to read strategic intelligence');
  assert(hasPermission('ADMIN' as any, PERMISSIONS.LEAD_READ), 'Test 9b: ADMIN has permission to read strategic intelligence');
  assert(hasPermission('MANAGER' as any, PERMISSIONS.LEAD_READ), 'Test 9c: MANAGER has permission to read strategic intelligence');

  // --- Category 10: Fail-Closed Database Write Guard Safety ---
  console.log('\n--- Category 10: Database Write Guard Safety ---');
  let writeBlocked = false;
  try {
    assertDatabaseWritesAllowed('Phase 26 strategy simulation mutation');
  } catch (e: any) {
    if (e.name === 'DatabaseWriteBlockedError') {
      writeBlocked = true;
    }
  }
  assert(writeBlocked, 'Test 10: Database write guard is fail-closed by default');

  // --- Category 11: Prompt Injection Quarantine ---
  console.log('\n--- Category 11: Prompt Injection Quarantine ---');
  const injectionData = mockContext.untrustedExternalData;
  assert(injectionData.length === 2, 'Test 11a: Untrusted malicious payloads present in mock data');
  const rawText = JSON.stringify(fullStrategy);
  assert(!rawText.includes('malicious()'), 'Test 11b: Untrusted strings not injected as executable instructions');

  // --- Category 12: Zero Autonomous Execution & Zero Email Transport ---
  console.log('\n--- Category 12: Zero Autonomous Execution & Zero Email Transport ---');
  assert(Boolean(fullStrategy.recommendedStrategy?.requiresHumanApproval), 'Test 12a: Strategic recommendations strictly require human approval');
  
  const stratEnginePath = path.join(__dirname, '../src/ai/executive/strategy/strategy-engine.ts');
  const stratEngineContent = fs.readFileSync(stratEnginePath, 'utf-8');
  assert(!stratEngineContent.includes('nodemailer'), 'Test 12b: Zero nodemailer in strategy engine');
  assert(!stratEngineContent.includes('resend'), 'Test 12c: Zero resend transport in strategy engine');
  assert(!stratEngineContent.includes('sendgrid'), 'Test 12d: Zero sendgrid transport in strategy engine');

  console.log('\n========================================================');
  console.log(`📊 PHASE 26 TEST RESULTS: ${passed}/${passed + failed} PASSED`);
  console.log('========================================================');
  if (failed === 0) {
    console.log('🎉 ALL PHASE 26 TESTS PASSED SUCCESSFULLY!\n');
  } else {
    process.exit(1);
  }
}

runPhase26Verification().catch((err) => {
  console.error('Phase 26 Verification Error:', err);
  process.exit(1);
});
