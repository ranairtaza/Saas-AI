import { ExecutiveStrategyService } from '../src/ai/executive/strategy/strategy-service';

async function verifyPhase43() {
  console.log('--- Phase 43: Executive Strategy & Priority Engine Verification ---\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Mock inputs representing Phase 40-42 data
  const mockGoals = [
    {
      id: 'goal-1',
      title: 'Q3 Revenue',
      kpiKey: 'company.revenue',
      targetValue: 1000000,
      currentValue: 800000,
      actualValue: 800000,
      outlook: 'ON_TRACK'
    },
    {
      id: 'goal-2',
      title: 'Q3 Leads',
      kpiKey: 'marketing.leads',
      targetValue: 500,
      currentValue: 200,
      actualValue: 200,
      outlook: 'LIKELY_TO_MISS'
    },
    {
      id: 'goal-3',
      title: 'Q3 Pipeline',
      kpiKey: 'sales.pipeline',
      targetValue: 2000000,
      currentValue: 1000000,
      actualValue: 1000000,
      outlook: 'LIKELY_TO_MISS'
    },
    {
      id: 'goal-4',
      title: 'Q3 Traffic',
      kpiKey: 'marketing.traffic',
      targetValue: 100000,
      currentValue: 90000,
      actualValue: 90000,
      outlook: 'AT_RISK'
    }
  ];

  const mockOutlooks = {
    'company.revenue': { historicalPeriodsUsed: 3 },
    'marketing.leads': { historicalPeriodsUsed: 2 },
    'sales.pipeline': { historicalPeriodsUsed: 4 },
    'marketing.traffic': { historicalPeriodsUsed: 2 },
  };

  const mockMetrics = {
    'company.revenue': { status: 'HEALTHY' },
    'marketing.leads': { status: 'STALE' },
    'sales.pipeline': { status: 'HEALTHY', confidence: 'HIGH', conflict: false, freshness: 'CURRENT' },
    'sales.conflict': { status: 'CONFLICTING', conflict: true },
    'marketing.traffic': { status: 'HEALTHY' }
  };

  const mockAnomalies = {
    'sales.pipeline': {
      type: 'SUDDEN_DROP',
      description: 'Pipeline dropped by 30% unexpectedly',
      severity: 'HIGH',
    },
    'company.revenue': {
      type: 'NEGATIVE_TREND',
      description: 'Revenue trend is negative',
      severity: 'HIGH',
    },
    'marketing.leads': {
      type: 'POSITIVE_SPIKE',
      description: 'Leads spiked unexpectedly',
      severity: 'LOW',
    }
  };

  try {
    const strategy = ExecutiveStrategyService.synthesizeStrategy({
      goals: mockGoals,
      outlooks: mockOutlooks,
      metrics: mockMetrics,
      anomalies: mockAnomalies,
    });

    // Verify Risk Engine outputs
    const staleRisk = strategy.risks.find(r => r.type === 'DATA_STALENESS');
    assert(!!staleRisk, 'RiskEngine detected DATA_STALENESS risk');
    assert(staleRisk?.measurementRisk === true, 'Data staleness is correctly flagged as a measurement risk');

    const conflictRisk = strategy.risks.find(r => r.type === 'DATA_CONFLICT');
    assert(!!conflictRisk, 'RiskEngine detected DATA_CONFLICT risk');

    const goalMissRisk = strategy.risks.find(r => r.type === 'GOAL_MISS');
    assert(!!goalMissRisk, 'RiskEngine detected GOAL_MISS risk based on LIKELY_TO_MISS outlook');
    assert(goalMissRisk?.severity === 'CRITICAL', 'GOAL_MISS risk for LIKELY_TO_MISS is CRITICAL severity');
    assert(goalMissRisk?.measurementRisk === false, 'Goal miss is NOT a measurement risk');

    const persistentUnderRisk = strategy.risks.find(r => r.type === 'PERSISTENT_UNDERPERFORMANCE');
    assert(!!persistentUnderRisk, 'RiskEngine detected PERSISTENT_UNDERPERFORMANCE for goal-3');
    assert(persistentUnderRisk?.severity === 'CRITICAL', 'PERSISTENT_UNDERPERFORMANCE risk is CRITICAL severity');

    const goalAtRisk = strategy.risks.find(r => r.type === 'GOAL_AT_RISK');
    assert(!!goalAtRisk, 'RiskEngine detected GOAL_AT_RISK risk based on AT_RISK outlook');
    assert(goalAtRisk?.severity === 'HIGH', 'GOAL_AT_RISK risk is HIGH severity');
    assert(goalAtRisk?.measurementRisk === false, 'GOAL_AT_RISK is NOT a measurement risk');

    const goalMissForAtRisk = strategy.risks.find(r => r.type === 'GOAL_MISS' && r.sourceGoals.includes('goal-4'));
    assert(!goalMissForAtRisk, 'AT_RISK goal is NOT classified as GOAL_MISS');

    const anomalyRisk = strategy.risks.find(r => r.type === 'KPI_DECLINE' && r.sourceMetrics.includes('company.revenue'));
    assert(!!anomalyRisk, 'RiskEngine detected KPI_DECLINE risk based on NEGATIVE_TREND anomaly');
    
    const positiveAnomalyRisk = strategy.risks.find(r => r.type === 'KPI_DECLINE' && r.sourceMetrics.includes('marketing.leads'));
    assert(!positiveAnomalyRisk, 'Positive anomaly does NOT create KPI_DECLINE');

    const conflictRiskLowConf = strategy.risks.find(r => r.type === 'DATA_CONFLICT' && r.sourceMetrics.includes('marketing.traffic'));
    assert(!conflictRiskLowConf, 'LOW confidence without explicit conflict flag does NOT create DATA_CONFLICT');

    // Negative boundary tests for Persistent Underperformance
    const persistentUnderRiskGoal2 = strategy.risks.find(r => r.type === 'PERSISTENT_UNDERPERFORMANCE' && r.sourceGoals.includes('goal-2'));
    assert(!persistentUnderRiskGoal2, 'historicalPeriods < 3 does NOT create PERSISTENT_UNDERPERFORMANCE');

    const staleMetricUnderperformance = strategy.risks.find(r => r.type === 'PERSISTENT_UNDERPERFORMANCE' && r.sourceGoals.includes('goal-2'));
    assert(!staleMetricUnderperformance, 'insufficient data (STALE) does NOT create PERSISTENT_UNDERPERFORMANCE');

    // Measurement/business isolation
    const conflictBusinessRisk = strategy.risks.find(r => (r.type === 'GOAL_MISS' || r.type === 'KPI_DECLINE' || r.type === 'PERSISTENT_UNDERPERFORMANCE') && r.sourceMetrics.includes('sales.conflict'));
    assert(!conflictBusinessRisk, 'DATA_CONFLICT does NOT automatically generate business risks (GOAL_MISS, KPI_DECLINE)');

    const staleRiskMeasurementOnly = strategy.risks.find(r => r.type === 'DATA_STALENESS');
    assert(staleRiskMeasurementOnly?.measurementRisk === true, 'DATA_STALENESS is strictly a measurement risk');

    const conflictRiskMeasurementOnly = strategy.risks.find(r => r.type === 'DATA_CONFLICT');
    assert(conflictRiskMeasurementOnly?.measurementRisk === true, 'DATA_CONFLICT is strictly a measurement risk');


    // Verify Priority Engine outputs
    const leadsPriority = strategy.priorities.find(p => p.sourceMetrics.includes('marketing.leads'));
    assert(!!leadsPriority, 'PriorityEngine created priority for LIKELY_TO_MISS goal');
    assert(leadsPriority?.category === 'LEAD_GENERATION', 'PriorityEngine correctly mapped metric to LEAD_GENERATION category');
    assert(leadsPriority?.priority === 'CRITICAL', 'PriorityEngine assigned CRITICAL priority');
    assert((leadsPriority?.relatedRisks?.length ?? 0) > 0, 'Priority is correctly linked to its related risks');

    // Verify Recommendation Engine outputs
    assert(strategy.recommendations.length > 0, 'RecommendationEngine generated draft recommendations');
    
    const draftRecs = strategy.recommendations.filter(r => r.status === 'DRAFT');
    assert(draftRecs.length === strategy.recommendations.length, 'All generated recommendations are in DRAFT status');

    const criticalRecs = strategy.recommendations.filter(r => r.priority === 'CRITICAL');
    assert(criticalRecs.length > 0, 'RecommendationEngine addressed CRITICAL risks/priorities');

  } catch (error) {
    console.error('Error during verification:', error);
    failed++;
  }

  console.log(`\nVerification Complete: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

verifyPhase43().catch(console.error);
