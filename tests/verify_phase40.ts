export {};

// MOCK PRISMA
const prismaMock = {
  lead: { count: async () => 0 },
  businessMetric: { 
    upsert: async (args: any) => ({ id: 'metric-1', key: args.create.key }),
    findMany: async () => []
  },
  metricSnapshot: { create: async () => ({}) },
  integrationConnection: { findMany: async () => [] },
  syncJob: { findFirst: async () => null }
};

// @ts-ignore
globalThis.prismaGlobal = prismaMock;

async function runPhase40Tests() {
  const { CrmSnapshotter } = await import('../src/business/metrics/crm-snapshotter');
  const { BusinessIntelligenceEngine } = await import('../src/ai/executive/bi-engine');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, message?: string) {
    if (condition) {
      passCount++;
      console.log(`✅ Passed: ${testName}`);
    } else {
      failCount++;
      console.error(`❌ FAILED: ${testName} - ${message || 'Assertion failed'}`);
    }
  }

  console.log('========================================================');
  console.log('🧪 LEADMACHINE — PHASE 40 VERIFICATION');
  console.log('========================================================\n');

  process.env.LEADMACHINE_DB_WRITES_ENABLED = 'true';
  process.env.LEADMACHINE_DATABASE_ID = 'leadmachine';

  const orgId = 'org-phase40-test';

  console.log('--- Test 1: CrmSnapshotter Default Snapshot ---');
  try {
    await CrmSnapshotter.snapshotOrganization(orgId); 
    const telemetry = await BusinessIntelligenceEngine.assembleTelemetry(orgId);
    const snapshot = telemetry.metrics;
    
    assert(snapshot.totalLeads.value === 0 || snapshot.totalLeads.value === null, 'totalLeads defaults to 0');
    assert(snapshot.activeLeadsCount.value === 0 || snapshot.activeLeadsCount.value === null, 'activeLeadsCount defaults to 0');
    assert(snapshot.qualifiedLeads.value === 0 || snapshot.qualifiedLeads.value === null, 'qualifiedLeads defaults to 0');
    assert(snapshot.unassignedHighPriorityLeads.value === 0, 'unassignedHighPriorityLeads defaults to 0');
    assert(snapshot.pipelineValue.value === null, 'pipelineValue defaults to 0 since it is UNAVAILABLE');
    assert(snapshot.pipelineValue.freshness === 'UNAVAILABLE', 'pipelineValue freshness is UNAVAILABLE');
  } catch (err: any) {
    assert(false, 'CrmSnapshotter Default Snapshot', err.message);
  }

  console.log('\n--- Test 2: BusinessIntelligenceEngine Aggregation & REVENUE_GROWTH ---');
  try {
    const fakeMetrics = [
      { key: 'REVENUE_MTD', unit: 'USD', snapshots: [{ value: 50000, source: 'stripe', timestamp: new Date() }] },
      { key: 'REVENUE_LAST_MONTH', unit: 'USD', snapshots: [{ value: 40000, source: 'stripe', timestamp: new Date() }] },
    ];
    
    prismaMock.businessMetric.findMany = async () => fakeMetrics as any;

    const telemetry = await BusinessIntelligenceEngine.assembleTelemetry(orgId);
    
    assert(telemetry.metrics.revenueGrowth !== undefined, 'revenueGrowth key exists');
    assert(telemetry.metrics.revenueGrowth?.value === 25, 'revenueGrowth is 25% (50k vs 40k)');
    assert(telemetry.metrics.revenueGrowth?.confidence === 'HIGH', 'revenueGrowth confidence is HIGH');
    assert(telemetry.metrics.revenueGrowth?.conflict === false, 'revenueGrowth has no conflict');
  } catch (err: any) {
    assert(false, 'BusinessIntelligenceEngine Aggregation', err.stack);
  }
  
  console.log('\n--- Test 3: Conflict Detection & Zero Denominator ---');
  try {
    const fakeMetrics2 = [
      { key: 'REVENUE_MTD', unit: 'USD', snapshots: [
          { value: 50000, source: 'stripe', timestamp: new Date() },
          { value: 100000, source: 'internal_system', timestamp: new Date() }
        ] 
      },
      { key: 'REVENUE_LAST_MONTH', unit: 'USD', snapshots: [
          { value: 0, source: 'stripe', timestamp: new Date() }
        ] 
      },
    ];
    
    prismaMock.businessMetric.findMany = async () => fakeMetrics2 as any;
    const telemetry2 = await BusinessIntelligenceEngine.assembleTelemetry(orgId);

    assert(telemetry2.metrics.revenueMTD.conflict === true, 'revenueMTD detects conflict');
    assert(telemetry2.metrics.revenueMTD.confidence === 'LOW', 'revenueMTD confidence drops to LOW on conflict');
    assert(telemetry2.metrics.revenueGrowth?.value === null, 'revenueGrowth handles zero denominator gracefully (returns null)');
  } catch (err: any) {
    assert(false, 'Conflict Detection', err.stack);
  }

  console.log('\n========================================================');
  console.log(`📊 PHASE 40 TEST RESULTS: ${passCount}/${passCount + failCount} PASSED`);
  console.log('========================================================');

  if (failCount > 0) {
    console.error(`❌ ${failCount} tests failed.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL PHASE 40 TESTS PASSED SUCCESSFULLY!\n');
  }
}

runPhase40Tests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
