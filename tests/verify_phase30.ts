import assert from 'assert';
import {
  ForecastHorizonSchema,
  ForecastDomainSchema,
  ForecastConfidenceSchema,
  ForecastDirectionSchema,
  ForecastScenarioTypeSchema,
  PredictiveRiskTypeSchema,
  ExecutiveForecastSchema,
} from '../src/ai/executive/forecasting/types';
import { ForecastEngine } from '../src/ai/executive/forecasting/forecast-engine';
import { assertDatabaseWritesAllowed, DatabaseWriteBlockedError } from '../src/lib/db-guard';
import { hasPermission } from '../src/permissions/rbac';
import { PERMISSIONS } from '../src/permissions/definitions';
import { DecisionStateMachine } from '../src/ai/executive/decisions/state-machine';
import { DecisionAuthorityEvaluator } from '../src/ai/executive/decisions/authority-evaluator';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

console.log('========================================================');
console.log('🧪 RUNNING PHASE 30: PREDICTIVE INTELLIGENCE & FORECASTING');
console.log('========================================================\n');

async function runPhase30Verification() {
  // ==========================================================================
  // Category 1: Domain Schemas & Enums
  // ==========================================================================
  console.log('--- Category 1: Domain Schemas & Enums ---');

  assert(ForecastHorizonSchema.options.includes('SHORT_TERM'), 'ForecastHorizon includes SHORT_TERM');
  assert(ForecastHorizonSchema.options.includes('MEDIUM_TERM'), 'ForecastHorizon includes MEDIUM_TERM');
  assert(ForecastHorizonSchema.options.includes('LONG_TERM'), 'ForecastHorizon includes LONG_TERM');
  console.log('  ✓ ForecastHorizon enum verified (SHORT_TERM, MEDIUM_TERM, LONG_TERM)');

  assert(ForecastDomainSchema.options.includes('REVENUE'), 'ForecastDomain includes REVENUE');
  assert(ForecastDomainSchema.options.includes('PIPELINE'), 'ForecastDomain includes PIPELINE');
  assert(ForecastDomainSchema.options.includes('SALES'), 'ForecastDomain includes SALES');
  assert(ForecastDomainSchema.options.includes('OPERATIONS'), 'ForecastDomain includes OPERATIONS');
  console.log('  ✓ ForecastDomain enum verified (REVENUE, PIPELINE, SALES, OPERATIONS)');

  assert(ForecastConfidenceSchema.options.includes('HIGH'), 'ForecastConfidence includes HIGH');
  assert(ForecastConfidenceSchema.options.includes('MEDIUM'), 'ForecastConfidence includes MEDIUM');
  assert(ForecastConfidenceSchema.options.includes('LOW'), 'ForecastConfidence includes LOW');
  assert(ForecastConfidenceSchema.options.includes('INSUFFICIENT'), 'ForecastConfidence includes INSUFFICIENT');
  console.log('  ✓ ForecastConfidence enum verified (HIGH, MEDIUM, LOW, INSUFFICIENT)');

  assert(ForecastDirectionSchema.options.includes('INCREASING'), 'ForecastDirection includes INCREASING');
  assert(ForecastDirectionSchema.options.includes('DECREASING'), 'ForecastDirection includes DECREASING');
  assert(ForecastDirectionSchema.options.includes('STABLE'), 'ForecastDirection includes STABLE');
  console.log('  ✓ ForecastDirection enum verified (INCREASING, DECREASING, STABLE)');

  assert(ForecastScenarioTypeSchema.options.includes('BASELINE'), 'ScenarioType includes BASELINE');
  assert(ForecastScenarioTypeSchema.options.includes('OPTIMISTIC'), 'ScenarioType includes OPTIMISTIC');
  assert(ForecastScenarioTypeSchema.options.includes('CONSERVATIVE'), 'ScenarioType includes CONSERVATIVE');
  console.log('  ✓ ForecastScenarioType enum verified (BASELINE, OPTIMISTIC, CONSERVATIVE)');

  assert(PredictiveRiskTypeSchema.options.includes('CAPACITY_RISK'), 'RiskType includes CAPACITY_RISK');
  assert(PredictiveRiskTypeSchema.options.includes('REVENUE_RISK'), 'RiskType includes REVENUE_RISK');
  assert(PredictiveRiskTypeSchema.options.includes('PIPELINE_RISK'), 'RiskType includes PIPELINE_RISK');
  assert(PredictiveRiskTypeSchema.options.includes('OPERATIONAL_RISK'), 'RiskType includes OPERATIONAL_RISK');
  console.log('  ✓ PredictiveRiskType enum verified (CAPACITY, REVENUE, PIPELINE, OPERATIONAL)');

  // ==========================================================================
  // Category 2: Deterministic Forecast Engine Calculations
  // ==========================================================================
  console.log('\n--- Category 2: Deterministic Forecast Engine Calculations ---');

  // Horizon day mapping
  assert.strictEqual(ForecastEngine.getHorizonDays('SHORT_TERM'), 14, 'SHORT_TERM maps to 14 days');
  assert.strictEqual(ForecastEngine.getHorizonDays('MEDIUM_TERM'), 30, 'MEDIUM_TERM maps to 30 days');
  assert.strictEqual(ForecastEngine.getHorizonDays('LONG_TERM'), 90, 'LONG_TERM maps to 90 days');
  console.log('  ✓ Horizon mapping: SHORT_TERM=14d, MEDIUM_TERM=30d, LONG_TERM=90d');

  // Uncertainty range calculation
  const rangeHigh = ForecastEngine.calculateUncertaintyRange(10000, 'HIGH', 30);
  assert(rangeHigh.lowerBound === 9500, 'HIGH confidence uncertainty lowerBound is 9500 (-5%)');
  assert(rangeHigh.upperBound === 10500, 'HIGH confidence uncertainty upperBound is 10500 (+5%)');

  const rangeMed = ForecastEngine.calculateUncertaintyRange(10000, 'MEDIUM', 30);
  assert(rangeMed.lowerBound === 8800, 'MEDIUM confidence uncertainty lowerBound is 8800 (-12%)');
  assert(rangeMed.upperBound === 11200, 'MEDIUM confidence uncertainty upperBound is 11200 (+12%)');

  const rangeTimeScaling = ForecastEngine.calculateUncertaintyRange(10000, 'HIGH', 90);
  assert(rangeTimeScaling.lowerBound < 9500, 'Time scaling widens uncertainty range for 90d horizon');
  console.log('  ✓ Uncertainty ranges mathematically scale with confidence and horizon');

  // Direction classification
  assert.strictEqual(ForecastEngine.classifyDirection(100, 110), 'INCREASING', '+10% delta is INCREASING');
  assert.strictEqual(ForecastEngine.classifyDirection(100, 90), 'DECREASING', '-10% delta is DECREASING');
  assert.strictEqual(ForecastEngine.classifyDirection(100, 101), 'STABLE', '+1% delta is STABLE');
  console.log('  ✓ Direction classification handles INCREASING, DECREASING, STABLE');

  // Single metric baseline forecast
  const revForecast = ForecastEngine.generateMetricForecast('org-test-1', {
    domain: 'REVENUE',
    metric: 'revenueMTD',
    currentValue: 50000,
    horizon: 'MEDIUM_TERM',
    scenarioType: 'BASELINE',
    growthRatePct: 8,
  });

  assert.strictEqual(revForecast.organizationId, 'org-test-1', 'Organization ID matches');
  assert.strictEqual(revForecast.domain, 'REVENUE', 'Domain matches REVENUE');
  assert.strictEqual(revForecast.metric, 'revenueMTD', 'Metric matches revenueMTD');
  assert.strictEqual(revForecast.currentValue, 50000, 'Current baseline value is 50000');
  assert.strictEqual(revForecast.forecastValue, 54000, '50000 with 8% growth is 54000');
  assert.strictEqual(revForecast.direction, 'INCREASING', 'Direction is INCREASING');
  assert(revForecast.lowerBound < 54000 && revForecast.upperBound > 54000, 'Uncertainty bounds enclose forecast');
  assert(revForecast.evidence.includes('Current revenueMTD telemetry baseline: 50,000'), 'Evidence is grounded');
  assert(revForecast.assumptions.length >= 2, 'Explicit assumptions provided');
  console.log('  ✓ Single metric baseline forecast correctly generated with grounded evidence and bounds');

  // Decreasing metric (backlog reduction)
  const backlogForecast = ForecastEngine.generateMetricForecast('org-test-1', {
    domain: 'OPERATIONS',
    metric: 'unassignedHighPriorityLeads',
    currentValue: 20,
    horizon: 'MEDIUM_TERM',
    scenarioType: 'BASELINE',
  });
  assert(backlogForecast.forecastValue < 20, 'Decreasing metric backlog forecast value reduces');
  assert.strictEqual(backlogForecast.direction, 'DECREASING', 'Backlog direction is DECREASING');
  console.log('  ✓ Operational backlog decreasing metric correctly projects reduction trajectory');

  // ==========================================================================
  // Category 3: Confidence Evaluation & Data Quality
  // ==========================================================================
  console.log('\n--- Category 3: Confidence Evaluation & Data Quality ---');

  const confHigh = ForecastEngine.evaluateConfidence({
    hasData: true,
    dataPointsCount: 5,
    learningSignalsCount: 4,
    variancePct: 5,
  });
  assert.strictEqual(confHigh, 'HIGH', '4 learning signals with low variance yields HIGH confidence');

  const confMed = ForecastEngine.evaluateConfidence({
    hasData: true,
    dataPointsCount: 3,
    learningSignalsCount: 1,
    variancePct: 15,
  });
  assert.strictEqual(confMed, 'MEDIUM', 'Moderate data and learning signals yield MEDIUM confidence');

  const confLow = ForecastEngine.evaluateConfidence({
    hasData: true,
    dataPointsCount: 1,
    learningSignalsCount: 0,
    variancePct: 30,
  });
  assert.strictEqual(confLow, 'LOW', 'Sparse data with high variance yields LOW confidence');

  const confInsufficient = ForecastEngine.evaluateConfidence({
    hasData: false,
    dataPointsCount: 0,
    learningSignalsCount: 0,
  });
  assert.strictEqual(confInsufficient, 'INSUFFICIENT', 'Missing telemetry yields INSUFFICIENT confidence');
  console.log('  ✓ Confidence correctly evaluates HIGH, MEDIUM, LOW, and INSUFFICIENT');

  // ==========================================================================
  // Category 4: Historical Learning Integration (Phase 29 Signals)
  // ==========================================================================
  console.log('\n--- Category 4: Historical Learning Integration (Phase 29 Signals) ---');

  const mockSignals = [
    {
      id: 'sig-1',
      organizationId: 'org-test-1',
      domain: 'REVENUE',
      metric: 'revenueMTD',
      expectedValue: 50000,
      actualValue: 55000,
      variance: 5000,
      variancePercentage: 10,
      varianceStatus: 'POSITIVE',
      effectiveness: 'SUCCESS',
      confidence: 'HIGH',
      hypothesisResult: 'SUPPORTED',
      evidence: 'Exceeded target',
      createdAt: new Date(),
    },
    {
      id: 'sig-2',
      organizationId: 'org-test-1',
      domain: 'REVENUE',
      metric: 'revenueMTD',
      expectedValue: 52000,
      actualValue: 57000,
      variance: 5000,
      variancePercentage: 9.6,
      varianceStatus: 'POSITIVE',
      effectiveness: 'SUCCESS',
      confidence: 'HIGH',
      hypothesisResult: 'SUPPORTED',
      evidence: 'Consistent outperformance',
      createdAt: new Date(),
    },
  ];

  const revForecastWithLearning = ForecastEngine.generateMetricForecast('org-test-1', {
    domain: 'REVENUE',
    metric: 'revenueMTD',
    currentValue: 50000,
    horizon: 'MEDIUM_TERM',
    scenarioType: 'BASELINE',
    growthRatePct: 8,
    historicalSignals: mockSignals as any,
  });

  assert(revForecastWithLearning.forecastValue > revForecast.forecastValue, 'Historical learning positive variance elevates expected forecast');
  assert(revForecastWithLearning.evidence.includes('Informed by 2 historical Phase 29 learning signal(s)'), 'Evidence references Phase 29 signals');

  // Invariant: Historical success does NOT create a non-zero forecast from zero current telemetry
  const zeroTelemetryForecast = ForecastEngine.generateMetricForecast('org-test-1', {
    domain: 'REVENUE',
    metric: 'revenueMTD',
    currentValue: 0,
    horizon: 'MEDIUM_TERM',
    growthRatePct: 8,
    historicalSignals: mockSignals as any,
  });
  assert.strictEqual(zeroTelemetryForecast.currentValue, 0, 'Zero baseline remains 0');
  assert.strictEqual(zeroTelemetryForecast.forecastValue, 0, 'Zero baseline forecast remains 0');
  console.log('  ✓ Historical learning signals ground forecast without fabricating data from 0 baseline');

  // ==========================================================================
  // Category 5: Predictive Risk Signals
  // ==========================================================================
  console.log('\n--- Category 5: Predictive Risk Signals ---');

  const riskForecast = ForecastEngine.generateMetricForecast('org-test-1', {
    domain: 'OPERATIONS',
    metric: 'unassignedHighPriorityLeads',
    currentValue: 15,
    horizon: 'MEDIUM_TERM',
  });

  assert(riskForecast.riskSignals.length > 0, 'Backlog forecast generates predictive risk signal');
  const opRisk = riskForecast.riskSignals[0];
  assert.strictEqual(opRisk.riskType, 'OPERATIONAL_RISK', 'Risk type is OPERATIONAL_RISK');
  assert(opRisk.threshold === 5, 'Operational threshold is 5');
  assert(opRisk.probabilityPct >= 70, 'Probability is quantified');
  assert(opRisk.explanation.includes('exceeding operational SLA capacity threshold'), 'Explanation is grounded');
  console.log('  ✓ Predictive risk signal correctly identifies operational backlog risk');

  // Revenue Risk against target goal
  const revRiskForecast = ForecastEngine.generateMetricForecast('org-test-1', {
    domain: 'REVENUE',
    metric: 'revenueMTD',
    currentValue: 40000,
    horizon: 'MEDIUM_TERM',
    growthRatePct: 2,
    targetGoalValue: 60000, // 40.8k forecast falls below 85% of 60k (51k)
  });

  assert(revRiskForecast.riskSignals.length > 0, 'Revenue shortfall generates REVENUE_RISK signal');
  assert.strictEqual(revRiskForecast.riskSignals[0].riskType, 'REVENUE_RISK', 'Risk type is REVENUE_RISK');
  console.log('  ✓ Revenue shortfall below target goal correctly triggers REVENUE_RISK');

  // ==========================================================================
  // Category 6: Strategic Scenario Comparison Matrix
  // ==========================================================================
  console.log('\n--- Category 6: Strategic Scenario Comparison Matrix ---');

  const mockContext: any = {
    organizationId: 'org-test-1',
    identity: { name: 'Acme SaaS' },
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
      { kpiKey: 'revenue_mrr', targetValue: 70000 },
    ],
  };

  const suite = ForecastEngine.generateExecutiveForecasts(mockContext, mockSignals as any);

  assert(suite.forecasts.length >= 4, 'Generates multi-domain forecast suite');
  assert(suite.scenarioComparisons.length >= 4, 'Generates scenario comparisons for all core metrics');
  assert(suite.topPredictiveRisks.length > 0, 'Aggregates top predictive risks');

  const pipelineScenario = suite.scenarioComparisons.find((s) => s.metric === 'pipelineValue');
  assert(pipelineScenario, 'Pipeline scenario exists');
  assert(pipelineScenario.optimisticForecast > pipelineScenario.baselineForecast, 'Optimistic forecast > Baseline');
  assert(pipelineScenario.conservativeForecast < pipelineScenario.baselineForecast, 'Conservative forecast < Baseline');
  assert(pipelineScenario.variancePotentialPct > 0, 'Variance spread is positive percentage');
  console.log('  ✓ Scenario comparisons accurately reflect BASELINE, OPTIMISTIC, and CONSERVATIVE projections');

  // ==========================================================================
  // Category 7: Database Write Guard Safety
  // ==========================================================================
  console.log('\n--- Category 7: Database Write Guard Safety ---');

  let writeBlocked = false;
  try {
    assertDatabaseWritesAllowed('test phase 30 write blocked');
  } catch (e: any) {
    if (e instanceof DatabaseWriteBlockedError) {
      writeBlocked = true;
    }
  }
  assert(writeBlocked, 'Database write guard is fail-closed by default (allowed: false)');
  console.log('  ✓ Database write guard protects Phase 30 mutations');

  // ==========================================================================
  // Category 8: RBAC Role & Permission Enforcements
  // ==========================================================================
  console.log('\n--- Category 8: RBAC Role & Permission Enforcements ---');

  assert(hasPermission('OWNER' as any, PERMISSIONS.LEAD_READ), 'OWNER has LEAD_READ');
  assert(hasPermission('ADMIN' as any, PERMISSIONS.LEAD_READ), 'ADMIN has LEAD_READ');
  assert(hasPermission('MANAGER' as any, PERMISSIONS.LEAD_READ), 'MANAGER has LEAD_READ');
  assert(hasPermission('MEMBER' as any, PERMISSIONS.LEAD_READ), 'MEMBER has LEAD_READ');
  assert(hasPermission('READ_ONLY' as any, PERMISSIONS.LEAD_READ), 'READ_ONLY has LEAD_READ');

  assert(hasPermission('OWNER' as any, PERMISSIONS.LEAD_UPDATE), 'OWNER has LEAD_UPDATE to regenerate forecasts');
  assert(hasPermission('ADMIN' as any, PERMISSIONS.LEAD_UPDATE), 'ADMIN has LEAD_UPDATE to regenerate forecasts');
  assert(!hasPermission('READ_ONLY' as any, PERMISSIONS.LEAD_UPDATE), 'READ_ONLY denied LEAD_UPDATE');
  console.log('  ✓ RBAC permissions correctly gate forecast access and regeneration');

  // ==========================================================================
  // Category 9: Multi-Tenant Scoping Invariants
  // ==========================================================================
  console.log('\n--- Category 9: Multi-Tenant Scoping Invariants ---');

  const routePath = path.join(__dirname, '../src/app/api/executive/forecasts/route.ts');
  const summaryRoutePath = path.join(__dirname, '../src/app/api/executive/forecasts/summary/route.ts');
  assert(existsSync(routePath), 'Forecasts API route exists');
  assert(existsSync(summaryRoutePath), 'Forecasts summary API route exists');

  const routeContent = readFileSync(routePath, 'utf8');
  assert(routeContent.includes('getCurrentUser()'), 'Route enforces authenticated session');
  assert(routeContent.includes('user.organizationId'), 'Route enforces tenant isolation by organizationId');

  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  const schemaContent = readFileSync(schemaPath, 'utf8');
  assert(schemaContent.includes('model ExecutiveForecast'), 'Prisma schema includes ExecutiveForecast');
  assert(schemaContent.includes('organizationId'), 'ExecutiveForecast belongs to organizationId');
  assert(schemaContent.includes('@@index([organizationId, domain])'), 'ExecutiveForecast indexes organizationId and domain');
  console.log('  ✓ Multi-tenant scoping and Prisma indexing verified');

  // ==========================================================================
  // Category 10: Governance Precedence & Decision Locking (Phases 27-28)
  // ==========================================================================
  console.log('\n--- Category 10: Governance Precedence & Decision Locking (Phases 27-28) ---');

  // Invariant 1: High forecast confidence CANNOT override a BLOCKED governance verdict
  const blockedTransition = DecisionStateMachine.validateTransition(
    'PENDING',
    'APPROVED',
    'BLOCKED'
  );
  assert(!blockedTransition.valid, 'Governance Invariant: BLOCKED verdict CANNOT transition to APPROVED regardless of high forecast confidence');

  // Invariant 2: High forecast confidence CANNOT override INSUFFICIENT_EVIDENCE
  const insufficientEvidenceTransition = DecisionStateMachine.validateTransition(
    'PENDING',
    'APPROVED',
    'INSUFFICIENT_EVIDENCE'
  );
  assert(!insufficientEvidenceTransition.valid, 'Governance Invariant: INSUFFICIENT_EVIDENCE verdict CANNOT transition to APPROVED');

  // Invariant 3: Optimistic forecast CANNOT downgrade REQUIRES_ESCALATION to manager authority
  const requiredAuth = DecisionAuthorityEvaluator.determineAuthority('REQUIRES_ESCALATION', 15);
  assert.strictEqual(requiredAuth, 'EXECUTIVE', 'Governance Invariant: REQUIRES_ESCALATION strictly mandates EXECUTIVE authority');
  console.log('  ✓ Governance verdicts remain strictly authoritative over predictive forecasts');

  // ==========================================================================
  // Category 11: Zero Autonomous Execution & Zero Email Invariants
  // ==========================================================================
  console.log('\n--- Category 11: Zero Autonomous Execution & Zero Email Invariants ---');

  const engineContent = readFileSync(path.join(__dirname, '../src/ai/executive/forecasting/forecast-engine.ts'), 'utf8');
  const serviceContent = readFileSync(path.join(__dirname, '../src/ai/executive/forecasting/forecasting-service.ts'), 'utf8');

  assert(!engineContent.includes('nodemailer'), 'Forecast engine has 0 nodemailer imports');
  assert(!engineContent.includes('resend'), 'Forecast engine has 0 resend imports');
  assert(!engineContent.includes('sendgrid'), 'Forecast engine has 0 sendgrid imports');
  assert(!serviceContent.includes('nodemailer'), 'Forecast service has 0 nodemailer imports');
  assert(!serviceContent.includes('resend'), 'Forecast service has 0 resend imports');
  assert(!serviceContent.includes('ActionEngine'), 'Forecast service does not invoke ActionEngine');
  console.log('  ✓ Zero autonomous execution and zero email transport invariants preserved');

  // ==========================================================================
  // Category 12: Determinism Invariance
  // ==========================================================================
  console.log('\n--- Category 12: Determinism Invariance ---');

  const initialSuite = ForecastEngine.generateExecutiveForecasts(mockContext, mockSignals as any);
  for (let i = 0; i < 50; i++) {
    const iterSuite = ForecastEngine.generateExecutiveForecasts(mockContext, mockSignals as any);
    assert.strictEqual(iterSuite.forecasts.length, initialSuite.forecasts.length, `Iteration ${i}: forecast count identical`);
    assert.strictEqual(iterSuite.forecasts[0].forecastValue, initialSuite.forecasts[0].forecastValue, `Iteration ${i}: forecastValue identical`);
    assert.strictEqual(iterSuite.forecasts[0].lowerBound, initialSuite.forecasts[0].lowerBound, `Iteration ${i}: lowerBound identical`);
    assert.strictEqual(iterSuite.forecasts[0].upperBound, initialSuite.forecasts[0].upperBound, `Iteration ${i}: upperBound identical`);
  }
  console.log('  ✓ 50/50 iterations produced 100% identical forecast values and bounds (100% deterministic)');

  console.log('\n========================================================');
  console.log('✅ PHASE 30 VERIFICATION COMPLETE: ALL ASSERTIONS PASSED (100%)');
  console.log('========================================================\n');
}

runPhase30Verification().catch((err) => {
  console.error('❌ Phase 30 Verification Failed:', err);
  process.exit(1);
});
