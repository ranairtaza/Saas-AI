// Setup Mock Prisma for tenant isolation and Executive Context tests BEFORE ANY IMPORTS
export {};

let mockGoalsDb: any[] = [];
let mockMetricsDb: any[] = [];
let mockForecastsDb: any[] = [];

const prismaMockPhase42 = {
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
      return mockMetricsDb.filter(m => m.organizationId === orgId) || [];
    },
    upsert: async (args: any) => ({ id: 'metric-1', key: args.create.key, latestValue: args.create.latestValue }),
  },
  metricSnapshot: {
    findMany: async () => [],
    create: async () => ({}),
  },
  businessGoal: {
    findMany: async (args: any) => {
      const orgId = args.where?.organizationId;
      let result = mockGoalsDb;
      if (orgId) result = result.filter(g => g.organizationId === orgId);
      if (args.where?.status?.notIn) {
        result = result.filter(g => !args.where.status.notIn.includes(g.status));
      } else if (args.where?.status === 'ACTIVE') {
        result = result.filter(g => g.status === 'ACTIVE');
      }
      return result;
    },
    findFirst: async (args: any) => {
      return mockGoalsDb.find(g => g.organizationId === args.where.organizationId && g.kpiKey === args.where.kpiKey);
    },
    findUnique: async (args: any) => {
      return mockGoalsDb.find(g => g.id === args.where.id);
    },
    create: async (args: any) => {
      const newGoal = { startDate: new Date(), currentValue: 0, unit: 'COUNT', ...args.data, id: crypto.randomUUID() };
      mockGoalsDb.push(newGoal);
      return newGoal;
    }
  },
  executiveMemoryEntry: { findMany: async () => [] },
  executiveRecommendation: { findMany: async () => [], count: async () => 0 },
  executiveEvent: { findMany: async () => [] },
  executiveOutcome: { findMany: async () => [] },
  executiveForecast: {
    findMany: async (args: any) => {
      return mockForecastsDb.filter(f => f.organizationId === args.where.organizationId);
    },
  },
  integrationConnection: { findMany: async () => [] },
  syncJob: { findFirst: async () => null },
};

import { prisma } from '../src/lib/db';

Object.assign(prisma.organization, prismaMockPhase42.organization);
Object.assign(prisma.lead, prismaMockPhase42.lead);
Object.assign(prisma.businessMetric, prismaMockPhase42.businessMetric);
Object.assign(prisma.metricSnapshot, prismaMockPhase42.metricSnapshot);
Object.assign(prisma.businessGoal, prismaMockPhase42.businessGoal);
Object.assign(prisma.executiveMemoryEntry, prismaMockPhase42.executiveMemoryEntry);
Object.assign(prisma.executiveRecommendation, prismaMockPhase42.executiveRecommendation);
Object.assign(prisma.executiveEvent, prismaMockPhase42.executiveEvent);
Object.assign(prisma.executiveOutcome, prismaMockPhase42.executiveOutcome);
Object.assign(prisma.executiveForecast, prismaMockPhase42.executiveForecast);
Object.assign(prisma.integrationConnection, prismaMockPhase42.integrationConnection);
Object.assign(prisma.syncJob, prismaMockPhase42.syncJob);

import { PlanningEngine } from '../src/ai/executive/planning/planning-engine';
import { RecommendationEngine } from '../src/ai/executive/planning/recommendation-engine';
import { BusinessContextBuilder } from '../src/ai/executive/context-builder';
import { ExecutiveForecastingService } from '../src/ai/executive/forecasting/forecasting-service';
import crypto from 'crypto';

// Override getPredictiveOutlook to return mocked forecasts
ExecutiveForecastingService.getPredictiveOutlook = async (orgId: string) => {
  const forecasts: any = {};
  for (const f of mockForecastsDb.filter(x => x.organizationId === orgId)) {
    forecasts[f.kpiKey] = f;
  }
  return { forecasts, trends: {}, anomalies: {}, generatedAt: new Date() };
};

async function runTests() {
  console.log('=== PHASE 42 VERIFICATION ===');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  const orgId = crypto.randomUUID();
  const orgId2 = crypto.randomUUID();

  try {
    // 1. Create Business Metrics
    mockMetricsDb.push(
      { organizationId: orgId, key: 'REVENUE_MTD', latestValue: 80000, snapshots: [{ value: 80000, timestamp: new Date(), source: 'crm' }], unit: 'CURRENCY' },
      { organizationId: orgId, key: 'ACTIVE_SUBSCRIPTIONS', latestValue: null, snapshots: [], unit: 'COUNT' },
      { organizationId: orgId, key: 'NEW_CUSTOMERS_MTD', latestValue: 0, snapshots: [{ value: 0, timestamp: new Date(), source: 'crm' }], unit: 'COUNT' }
    );

    // Create Goals (intentionally setting currentValue to garbage 99999 to prove it's ignored)
    mockGoalsDb.push(
      { organizationId: orgId, title: 'Rev Goal', kpiKey: 'revenueMTD', targetValue: 100000, currentValue: 99999, startDate: new Date(), endDate: new Date(Date.now() + 86400000), status: 'ACTIVE', source: 'USER_DEFINED', period: 'MONTH', unit: 'CURRENCY', id: crypto.randomUUID() },
      { organizationId: orgId, title: 'Missing Goal', kpiKey: 'activeSubscriptions', targetValue: 50, currentValue: 99999, startDate: new Date(), endDate: new Date(Date.now() + 86400000), status: 'ACTIVE', source: 'USER_DEFINED', period: 'MONTH', unit: 'COUNT', id: crypto.randomUUID() },
      { organizationId: orgId, title: 'Zero Goal', kpiKey: 'newCustomersMTD', targetValue: 10, currentValue: 99999, startDate: new Date(), endDate: new Date(Date.now() + 86400000), status: 'ACTIVE', source: 'USER_DEFINED', period: 'MONTH', unit: 'COUNT', id: crypto.randomUUID() }
    );

    // Mock forecasts
    mockForecastsDb.push(
      { organizationId: orgId, kpiKey: 'revenueMTD', forecastedValue: 105000, confidence: 'HIGH', period: 'MONTH', validUntil: new Date(Date.now() + 86400000) },
      { organizationId: orgId, kpiKey: 'activeSubscriptions', forecastedValue: 40, confidence: 'MEDIUM', period: 'MONTH', validUntil: new Date(Date.now() + 86400000) }
    );

    const goals = await PlanningEngine.evaluateGoals(orgId);
    
    // 1. Valid goal creation & tenant isolation
    assert(goals.length === 3, 'Evaluates active goals accurately for tenant');
    
    const revGoal = goals.find(g => g.kpiKey === 'revenueMTD');
    const missingGoal = goals.find(g => g.kpiKey === 'activeSubscriptions');
    const zeroGoal = goals.find(g => g.kpiKey === 'newCustomersMTD');

    // 2. Progress Calculation (proving currentValue is ignored)
    assert(revGoal?.progressPct === 80, 'Correct actual/target calculation (80k / 100k) ignoring currentValue');
    assert(missingGoal?.progressPct === null, 'Missing actual -> UNKNOWN progress (null)');
    assert(zeroGoal?.progressPct === 0, 'Actual zero preserved in progress');

    // 3. Forecast Comparison
    assert(revGoal?.outlook === 'ON_TRACK', 'Forecast above target is ON_TRACK');
    assert(missingGoal?.outlook === 'LIKELY_TO_MISS', 'Forecast below target (40/50 = 80%) is LIKELY_TO_MISS');
    assert(zeroGoal?.outlook === 'INSUFFICIENT_DATA', 'Missing forecast is INSUFFICIENT_DATA');

    // 4. Confidence Propagation (weakest link)
    assert(revGoal?.confidence === 'HIGH', 'Confidence propagation (HIGH forecast, actual REAL_TIME -> HIGH)');
    assert(missingGoal?.confidence === 'LOW', 'Confidence downgraded to LOW because actual is missing (actualScore=1)');

    // Priority Check
    assert(revGoal?.priority === 'LOW', 'ON_TRACK -> LOW priority');
    assert(missingGoal?.priority === 'MEDIUM', 'LIKELY_TO_MISS + LOW confidence -> MEDIUM priority');

    // 5. Tenant Isolation
    const otherOrgGoals = await PlanningEngine.evaluateGoals(orgId2);
    assert(otherOrgGoals.length === 0, 'Organization cannot read B\'s goals');

    // 6. Recommendation Engine
    const mockPredictiveOutlook = {
      forecasts: {
        'NEW_KPI': { forecastedValue: 500, confidence: 'HIGH', unit: 'COUNT' },
        'LOW_CONF_KPI': { forecastedValue: 300, confidence: 'LOW', unit: 'COUNT' },
      }
    };

    const recommendations = await RecommendationEngine.generateGoalRecommendations(orgId, mockPredictiveOutlook);
    assert(recommendations.length === 1, 'Generates recommendation only for HIGH confidence forecast');
    assert(recommendations[0].suggestedTarget === 525, 'Recommendation target adds 5% stretch');
    assert(recommendations[0].explanation.includes('500'), 'Recommendation explanation grounded in metrics');

    const recommendedDbGoal = mockGoalsDb.find(g => g.id === recommendations[0].id);
    assert(recommendedDbGoal?.status === 'DRAFT', 'System recommendation remains non-active (DRAFT)');
    assert(recommendedDbGoal?.source === 'SYSTEM_RECOMMENDED', 'System recommendation source correctly tagged');

    // 7. Context Builder Integration
    const context = await BusinessContextBuilder.buildBusinessContext(orgId);
    assert(Array.isArray(context.planning?.goals), 'Executive context separates planning goals');
    assert(context.planning?.goals.length === 3, 'Draft recommendations are excluded from active planning');

  } catch (e: any) {
    console.error('Test execution error:', e);
    failed++;
  }

  console.log(`\nResults: ${passed} / ${passed + failed} passed.`);
  if (failed > 0) process.exit(1);
}

runTests();
