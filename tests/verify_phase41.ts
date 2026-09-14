export {};

// Setup Mock Prisma for tenant isolation and Executive Context tests BEFORE ANY IMPORTS
const mockMetricsDb: Record<string, any[]> = {};

const prismaMockPhase41 = {
  organization: {
    findUnique: async (args: any) => ({
      id: args.where.id,
      name: 'Acme Test Corp',
      industry: 'B2B Software',
      BusinessProfile: null,
    }),
  },
  lead: {
    count: async () => 0,
    findMany: async () => [],
  },
  businessMetric: {
    findMany: async (args: any) => {
      const orgId = args.where.organizationId;
      return mockMetricsDb[orgId] || [];
    },
    upsert: async (args: any) => ({ id: 'metric-1', key: args.create.key }),
  },
  metricSnapshot: {
    findMany: async () => [],
    create: async () => ({}),
  },
  businessGoal: {
    findMany: async () => [],
  },
  executiveMemoryEntry: {
    findMany: async () => [],
  },
  executiveRecommendation: {
    findMany: async () => [],
  },
  executiveEvent: {
    findMany: async () => [],
  },
  executiveOutcome: {
    findMany: async () => [],
  },
  executiveForecast: {
    deleteMany: async () => ({ count: 0 }),
    create: async (args: any) => ({ ...args.data, id: 'forecast-1', createdAt: new Date(), updatedAt: new Date() }),
    findMany: async () => [],
  },
  integrationConnection: {
    findMany: async () => [],
  },
  syncJob: {
    findFirst: async () => null,
  },
};

// @ts-ignore
globalThis.prismaGlobal = prismaMockPhase41;

async function runPhase41Tests() {
  console.log('========================================================');
  console.log('🧪 LEADMACHINE — PHASE 41 VERIFICATION');
  console.log('   Predictive Business Intelligence & Forecasting');
  console.log('========================================================\n');

  // Dynamic imports after prisma mock is attached
  const { DataQualityGate } = await import('../src/ai/executive/forecasting/data-quality-gate');
  const { ForecastEngine } = await import('../src/ai/executive/forecasting/forecast-engine');
  const { ExecutiveForecastingService } = await import('../src/ai/executive/forecasting/forecasting-service');
  const { BusinessContextBuilder } = await import('../src/ai/executive/context-builder');

  let passed = 0;
  let failed = 0;

  function test(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      console.log(`✅ Passed: ${testName}`);
    } else {
      failed++;
      console.error(`❌ FAILED: ${testName} - ${detail || 'Assertion failed'}`);
    }
  }

  // ==========================================================================
  // Section 1: Data Quality Gate & Sufficiency
  // ==========================================================================
  console.log('--- Section 1: Data Quality Gate & Sufficiency ---');

  // Test 1.1: Insufficient data (< 3 periods) returns INSUFFICIENT_DATA
  const twoPeriods = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 10000, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 12000, source: 'stripe' },
  ];
  const qgTwo = DataQualityGate.validate('REVENUE_MTD', twoPeriods);
  test(qgTwo.status === 'INSUFFICIENT_DATA', 'DataQualityGate flags < 3 periods as INSUFFICIENT_DATA');
  test(qgTwo.validPeriods.length === 2, 'Valid periods count is preserved (2)');

  // Test 1.2: 3+ valid periods returns VALID
  const threePeriods = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 10000, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 12000, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 14000, source: 'stripe' },
  ];
  const qgThree = DataQualityGate.validate('REVENUE_MTD', threePeriods);
  test(qgThree.status === 'VALID', 'DataQualityGate accepts 3 valid periods as VALID');
  test(qgThree.validPeriods.length === 3, 'Valid periods count is 3');

  // Test 1.3: Missing periods are detected and NEVER silently converted to zero
  const gappedPeriods = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 10000, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 14000, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: 15000, source: 'stripe' },
  ];
  const qgGapped = DataQualityGate.validate('REVENUE_MTD', gappedPeriods);
  test(qgGapped.hasMissingPeriods === true, 'Gaps in historical periods are detected');
  test(!qgGapped.validPeriods.some((p) => p.value === 0), 'Missing period was NOT silently converted to zero');

  // Test 1.4: Source conflict detection in the same period
  const conflictPeriods = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 10000, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 12000, source: 'stripe' },
    { timestamp: new Date('2026-03-10T00:00:00Z'), value: 14000, source: 'stripe' },
    { timestamp: new Date('2026-03-12T00:00:00Z'), value: 20000, source: 'internal_crm' }, // > 5% conflict
  ];
  const qgConflict = DataQualityGate.validate('REVENUE_MTD', conflictPeriods);
  test(qgConflict.status === 'CONFLICTING', 'Conflicting multi-source observations produce CONFLICTING status');
  test(qgConflict.hasConflict === true, 'Conflict flag is true');

  // ==========================================================================
  // Section 2: Deterministic Forecasting (Weighted Moving Average)
  // ==========================================================================
  console.log('\n--- Section 2: Deterministic Forecasting ---');

  // Test 2.1: Valid 5 periods produces exact mathematical WMA forecast
  // Values: 100, 110, 120, 130, 140
  // Weights: 1, 2, 3, 4, 5 -> sum = 15
  // Weighted sum: 100 + 220 + 360 + 520 + 700 = 1900
  // 1900 / 15 = 126.67
  const asOfMay = new Date('2026-05-20T00:00:00Z');
  const fivePeriods = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 100, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 110, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 120, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: 130, source: 'stripe' },
    { timestamp: new Date('2026-05-15T00:00:00Z'), value: 140, source: 'stripe' },
  ];
  const forecastResult = ForecastEngine.forecastMetric('REVENUE_MTD', fivePeriods, { asOfDate: asOfMay });
  test(forecastResult.status === 'FORECASTED', 'Status is FORECASTED for 5 valid periods');
  test(forecastResult.forecastValue === 126.67, `Exact deterministic WMA forecast (expected 126.67, got ${forecastResult.forecastValue})`);
  test(forecastResult.forecastPeriod === '2026-06', `Forecast period correctly increments to 2026-06 (got ${forecastResult.forecastPeriod})`);
  test(forecastResult.method === 'WEIGHTED_MOVING_AVERAGE', 'Method is WEIGHTED_MOVING_AVERAGE');
  test(forecastResult.historicalPeriodsUsed === 5, 'Historical periods used is 5');
  test(forecastResult.source.historicalMetrics.includes('REVENUE_MTD'), 'Historical metric provenance retained');

  // Test 2.2: Insufficient data does NOT produce zero forecastValue
  const forecastInsufficient = ForecastEngine.forecastMetric('REVENUE_MTD', twoPeriods);
  test(forecastInsufficient.status === 'INSUFFICIENT_DATA', 'Insufficient data yields INSUFFICIENT_DATA status');
  test(forecastInsufficient.forecastValue === null, 'forecastValue is null (NEVER numeric 0 for insufficient data)');
  test(forecastInsufficient.confidence === 'INSUFFICIENT_DATA', 'Confidence is INSUFFICIENT_DATA');

  // Test 2.3: Conflicting source data yields CONFLICTING status with null forecastValue
  const forecastConflict = ForecastEngine.forecastMetric('REVENUE_MTD', conflictPeriods);
  test(forecastConflict.status === 'CONFLICTING', 'Conflicting data yields CONFLICTING status');
  test(forecastConflict.forecastValue === null, 'Conflicting data has null forecastValue');

  // ==========================================================================
  // Section 3: Mathematical Safety & Denominator Protection
  // ==========================================================================
  console.log('\n--- Section 3: Mathematical Safety ---');

  // Test 3.1: Null, undefined, NaN, and Infinity in historical snapshots are safely rejected
  const dirtySnapshots = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 100, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: null as any, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: NaN, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: Infinity, source: 'stripe' },
    { timestamp: new Date('2026-05-15T00:00:00Z'), value: -50, source: 'stripe' }, // Negative revenue rejected
    { timestamp: new Date('2026-06-15T00:00:00Z'), value: 120, source: 'stripe' },
    { timestamp: new Date('2026-07-15T00:00:00Z'), value: 130, source: 'stripe' },
  ];
  const safeForecast = ForecastEngine.forecastMetric('REVENUE_MTD', dirtySnapshots, { asOfDate: new Date('2026-07-20T00:00:00Z') });
  test(safeForecast.status === 'FORECASTED', 'Dirty snapshots cleaned safely');
  test(safeForecast.historicalPeriodsUsed === 3, 'Only 3 valid positive numbers retained');
  test(safeForecast.forecastValue !== null && !isNaN(safeForecast.forecastValue) && isFinite(safeForecast.forecastValue), 'No NaN or Infinity produced');

  // ==========================================================================
  // Section 4: Confidence Model
  // ==========================================================================
  console.log('\n--- Section 4: Confidence Model ---');

  // Test 4.1: 5+ fresh stable periods -> HIGH confidence
  test(forecastResult.confidence === 'HIGH', '5 fresh stable periods receives HIGH confidence');

  // Test 4.2: 3 fresh stable periods -> MEDIUM confidence
  const forecastThree = ForecastEngine.forecastMetric('REVENUE_MTD', threePeriods, { asOfDate: new Date('2026-03-20T00:00:00Z') });
  test(forecastThree.confidence === 'MEDIUM', '3 fresh periods receives MEDIUM confidence');

  // Test 4.3: High volatility reduces confidence
  const volatilePeriods = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 10, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 500, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 20, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: 800, source: 'stripe' },
    { timestamp: new Date('2026-05-15T00:00:00Z'), value: 15, source: 'stripe' },
  ];
  const volatileForecast = ForecastEngine.forecastMetric('REVENUE_MTD', volatilePeriods, { asOfDate: asOfMay });
  test(volatileForecast.confidence !== 'HIGH', 'High historical volatility downgrades confidence from HIGH');

  // Test 4.4: Missing periods downgrade confidence
  const gappedForecast = ForecastEngine.forecastMetric('REVENUE_MTD', [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 100, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 110, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: 120, source: 'stripe' },
    { timestamp: new Date('2026-05-15T00:00:00Z'), value: 130, source: 'stripe' },
    { timestamp: new Date('2026-06-15T00:00:00Z'), value: 140, source: 'stripe' },
  ], { asOfDate: new Date('2026-06-20T00:00:00Z') });
  test(gappedForecast.confidence === 'MEDIUM', 'Period gaps downgrade 5-period confidence from HIGH to MEDIUM');

  // Test 4.5: Stale data downgrades confidence to LOW
  const staleForecast = ForecastEngine.forecastMetric('REVENUE_MTD', fivePeriods, { asOfDate: new Date('2026-11-01T00:00:00Z') });
  test(staleForecast.confidence === 'LOW', 'Stale historical snapshots downgrade confidence to LOW');

  // Test 4.6: Penalties stack monotonically (Volatility + Missing + Stale -> LOW)
  const monotonicPeriods = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 10, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 500, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: 20, source: 'stripe' },
    { timestamp: new Date('2026-05-15T00:00:00Z'), value: 800, source: 'stripe' },
    { timestamp: new Date('2026-06-15T00:00:00Z'), value: 15, source: 'stripe' },
  ];
  const monotonicForecast = ForecastEngine.forecastMetric('REVENUE_MTD', monotonicPeriods, { asOfDate: new Date('2026-11-01T00:00:00Z') });
  test(monotonicForecast.confidence === 'LOW', 'Confidence penalties stack monotonically down to LOW');

  // Test 4.7: Legitimate zero values are preserved
  const zeroPeriods = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 0, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 0, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 0, source: 'stripe' },
  ];
  const zeroForecast = ForecastEngine.forecastMetric('REVENUE_MTD', zeroPeriods);
  test(zeroForecast.forecastValue === 0, 'Legitimate zero values are preserved and forecast as 0');

  // ==========================================================================
  // Section 5: Trend Detection
  // ==========================================================================
  console.log('\n--- Section 5: Trend Detection ---');

  // Test 5.1: Strongly increasing trend
  const strongInc = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 100, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 120, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 150, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: 190, source: 'stripe' },
  ];
  const trendStrongInc = ForecastEngine.detectTrend('REVENUE_MTD', strongInc);
  test(trendStrongInc.trend === 'STRONGLY_INCREASING', 'Detects STRONGLY_INCREASING trend');

  // Test 5.2: Stable trend
  const stableSeries = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 100, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 101, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 100, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: 101, source: 'stripe' },
  ];
  const trendStable = ForecastEngine.detectTrend('REVENUE_MTD', stableSeries);
  test(trendStable.trend === 'STABLE', 'Detects STABLE trend');

  // Test 5.3: Decreasing trend
  const decreasingSeries = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 100, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 95, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 90, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: 85, source: 'stripe' },
  ];
  const trendDecreasing = ForecastEngine.detectTrend('REVENUE_MTD', decreasingSeries);
  test(trendDecreasing.trend === 'DECREASING', 'Detects DECREASING trend');

  // Test 5.4: Insufficient data for trend
  const trendInsuff = ForecastEngine.detectTrend('REVENUE_MTD', twoPeriods);
  test(trendInsuff.trend === 'INSUFFICIENT_DATA', 'Returns INSUFFICIENT_DATA for trend with < 3 periods');

  // ==========================================================================
  // Section 6: Anomaly Detection
  // ==========================================================================
  console.log('\n--- Section 6: Anomaly Detection ---');

  const baselineSnapshots = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 100, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 102, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 98, source: 'stripe' },
    { timestamp: new Date('2026-04-15T00:00:00Z'), value: 101, source: 'stripe' },
  ];

  // Test 6.1: Normal observation
  const anomalyNormal = ForecastEngine.detectAnomaly('REVENUE_MTD', baselineSnapshots, 103);
  test(anomalyNormal.status === 'NORMAL', 'Normal observation returns NORMAL status');

  // Test 6.2: Outlier observation
  const anomalyOutlier = ForecastEngine.detectAnomaly('REVENUE_MTD', baselineSnapshots, 250);
  test(anomalyOutlier.status === 'ANOMALY', 'Outlier observation returns ANOMALY status');

  // Test 6.3: Insufficient history
  const anomalyInsuff = ForecastEngine.detectAnomaly('REVENUE_MTD', twoPeriods, 105);
  test(anomalyInsuff.status === 'INSUFFICIENT_DATA', 'Insufficient baseline returns INSUFFICIENT_DATA');

  // ==========================================================================
  // Section 7: Forecast vs Actual Evaluation
  // ==========================================================================
  console.log('\n--- Section 7: Forecast vs Actual Evaluation ---');

  // Test 7.1: Standard evaluation with non-zero actual
  const eval1 = ForecastEngine.evaluateForecast('REVENUE_MTD', '2026-06', 125000, 118000);
  test(eval1.status === 'EVALUATED', 'Evaluation status is EVALUATED');
  test(eval1.absoluteError === -7000, 'Absolute error is correct (118000 - 125000 = -7000)');
  test(eval1.percentageError === -5.93, `Percentage error is correct (-5.93%, got ${eval1.percentageError}%)`);

  // Test 7.2: Zero-denominator protection on actual === 0
  const evalZero = ForecastEngine.evaluateForecast('REVENUE_MTD', '2026-06', 5000, 0);
  test(evalZero.status === 'EVALUATED', 'Zero actual evaluation succeeds');
  test(evalZero.absoluteError === -5000, 'Absolute error calculated for zero actual');
  test(evalZero.percentageError === null, 'Percentage error safely returns null when actual is zero (no division by zero)');

  // Test 7.3: Missing actual remains UNKNOWN
  const evalMissing = ForecastEngine.evaluateForecast('REVENUE_MTD', '2026-06', 125000, null);
  test(evalMissing.status === 'UNKNOWN', 'Missing actual remains status UNKNOWN');
  test(evalMissing.actualValue === null, 'actualValue is null');
  test(evalMissing.absoluteError === null, 'absoluteError is null');
  test(evalMissing.percentageError === null, 'percentageError is null');

  // ==========================================================================
  // Section 8: Historical Truth Preservation & Non-Mutation
  // ==========================================================================
  console.log('\n--- Section 8: Historical Truth Preservation ---');

  const originalHistory = [
    { timestamp: new Date('2026-01-15T00:00:00Z'), value: 50000, source: 'stripe' },
    { timestamp: new Date('2026-02-15T00:00:00Z'), value: 55000, source: 'stripe' },
    { timestamp: new Date('2026-03-15T00:00:00Z'), value: 60000, source: 'stripe' },
  ];
  const snapshotClone = JSON.parse(JSON.stringify(originalHistory));

  const generated = ForecastEngine.forecastMetric('REVENUE_MTD', originalHistory);
  test(generated.forecastValue !== originalHistory[2].value, 'Forecast value is distinct from historical observation');
  test(JSON.stringify(originalHistory) === JSON.stringify(snapshotClone), 'Historical snapshot series was NOT mutated');

  // ==========================================================================
  // Section 9: Multi-Tenant Isolation
  // ==========================================================================
  console.log('\n--- Section 9: Multi-Tenant Isolation ---');

  const orgA = 'org-tenant-alpha';
  const orgB = 'org-tenant-beta';

  mockMetricsDb[orgA] = [
    {
      key: 'REVENUE_MTD',
      snapshots: [
        { timestamp: new Date('2026-01-15T00:00:00Z'), value: 10000, source: 'stripe' },
        { timestamp: new Date('2026-02-15T00:00:00Z'), value: 12000, source: 'stripe' },
        { timestamp: new Date('2026-03-15T00:00:00Z'), value: 14000, source: 'stripe' },
      ],
    },
  ];

  mockMetricsDb[orgB] = [
    {
      key: 'REVENUE_MTD',
      snapshots: [
        { timestamp: new Date('2026-01-15T00:00:00Z'), value: 999999, source: 'stripe' },
        { timestamp: new Date('2026-02-15T00:00:00Z'), value: 999999, source: 'stripe' },
        { timestamp: new Date('2026-03-15T00:00:00Z'), value: 999999, source: 'stripe' },
      ],
    },
  ];

  const outlookA = await ExecutiveForecastingService.getPredictiveOutlook(orgA);
  const outlookB = await ExecutiveForecastingService.getPredictiveOutlook(orgB);

  test(outlookA.forecasts.REVENUE_MTD.status === 'FORECASTED', 'Tenant A receives forecast');
  test(outlookB.forecasts.REVENUE_MTD.status === 'FORECASTED', 'Tenant B receives forecast');
  test(
    outlookA.forecasts.REVENUE_MTD.forecastValue < 20000,
    'Tenant A forecast uses only Tenant A historical data'
  );
  test(
    outlookB.forecasts.REVENUE_MTD.forecastValue > 900000,
    'Tenant B forecast uses only Tenant B historical data'
  );

  // ==========================================================================
  // Section 10: Executive Context Integration
  // ==========================================================================
  console.log('\n--- Section 10: Executive Context Integration ---');

  const context = await BusinessContextBuilder.buildBusinessContext(orgA);
  test(context.telemetry !== undefined, 'BusinessContext contains observed telemetry facts');
  test(context.predictiveOutlook !== undefined, 'BusinessContext contains predictiveOutlook');
  test(
    context.predictiveOutlook?.forecasts !== undefined,
    'predictiveOutlook contains forecasts'
  );
  test(
    context.predictiveOutlook?.trends !== undefined,
    'predictiveOutlook contains trends'
  );
  test(
    context.predictiveOutlook?.anomalies !== undefined,
    'predictiveOutlook contains anomalies'
  );

  // Check that observed telemetry remains separate and untouched
  test(
    context.telemetry.metrics.revenueMTD !== undefined,
    'telemetry.metrics.revenueMTD remains observed truth layer'
  );
  test(
    // @ts-ignore
    context.telemetry.metrics.revenueMTD.forecastValue === undefined,
    'Observed telemetry metric does NOT contain merged forecast fields'
  );

  console.log('\n========================================================');
  console.log(`📊 PHASE 41 TEST RESULTS: ${passed}/${passed + failed} PASSED`);
  console.log('========================================================');

  if (failed > 0) {
    console.error(`❌ ${failed} tests failed.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL PHASE 41 TESTS PASSED SUCCESSFULLY!\n');
  }
}

runPhase41Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
