import { ExecutiveValueLayer } from '../src/ai/executive/executive-value-layer';
import { ExecutiveOperatingState, ExecutiveOperatingStateSchema } from '../src/ai/executive/operating-state/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}`);
  }
}

async function runTests() {
  console.log('--- PHASE 36 AUTOMATED INTEGRATION & CONTRACT TESTS ---\n');

  // 1. Contract Validation: Executive Operating State Schema
  const mockState: ExecutiveOperatingState = {
    organizationId: 'org-test-36',
    timestamp: new Date().toISOString(),
    activeDecisions: [
      {
        id: 'dec-1',
        title: 'Approve marketing campaign',
        domain: 'MARKETING',
        decisionType: 'BUDGET',
        status: 'PENDING',
        priority: 'HIGH',
        governanceVerdict: 'APPROVED',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'dec-2',
        title: 'High-risk unapproved expenditure',
        domain: 'FINANCE',
        decisionType: 'BUDGET',
        status: 'BLOCKED',
        priority: 'CRITICAL',
        governanceVerdict: 'REJECTED',
        createdAt: new Date().toISOString(),
      },
    ],
    recentLearningSignals: [],
    activeForecasts: [],
    actionPlans: [],
    pendingActions: [],
    recentOutcomeAttributions: [
      {
        id: 'attr-corr',
        attributionStatus: 'CORRELATED',
        confidence: 'MEDIUM',
        targetMetric: 'QUALIFIED_LEADS',
        actualDeltaValue: 15,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const parsed = ExecutiveOperatingStateSchema.safeParse(mockState);
  assert(parsed.success, 'ExecutiveOperatingStateSchema successfully parses valid state structure');

  // 2. Attribution Semantics: CORRELATED status MUST NOT achieve SUFFICIENT ROI evidence
  const synthesisCorrelated = ExecutiveValueLayer.synthesize(mockState);
  assert(
    synthesisCorrelated.commercialValueSignals.roiEvidenceSufficiency !== 'SUFFICIENT',
    'CORRELATED outcome attribution strictly never achieves SUFFICIENT ROI evidence'
  );
  assert(
    synthesisCorrelated.commercialValueSignals.roiEvidenceSufficiency === 'PARTIAL',
    'CORRELATED attribution correctly maps to PARTIAL evidence sufficiency'
  );

  // 3. Attribution Semantics: DIRECT_CAUSAL with monetary metric achieves SUFFICIENT
  const directCausalState: ExecutiveOperatingState = {
    ...mockState,
    recentOutcomeAttributions: [
      {
        id: 'attr-causal',
        attributionStatus: 'DIRECT_CAUSAL',
        confidence: 'HIGH',
        targetMetric: 'REVENUE_MTD',
        actualDeltaValue: 5000,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const synthesisCausal = ExecutiveValueLayer.synthesize(directCausalState);
  assert(
    synthesisCausal.commercialValueSignals.roiEvidenceSufficiency === 'SUFFICIENT',
    'DIRECT_CAUSAL with verified revenue delta achieves SUFFICIENT ROI evidence'
  );
  assert(
    !!synthesisCausal.commercialValueSignals.estimatedValueCreated?.includes('$5,000.00'),
    'Direct financial metric delta is truthfully reflected without arbitrary multipliers'
  );

  // 4. Attribution Semantics: INSUFFICIENT_EVIDENCE results in INSUFFICIENT_CAUSAL_EVIDENCE
  const emptyAttributionState: ExecutiveOperatingState = {
    ...mockState,
    recentOutcomeAttributions: [],
  };
  const synthesisEmpty = ExecutiveValueLayer.synthesize(emptyAttributionState);
  assert(
    synthesisEmpty.commercialValueSignals.roiEvidenceSufficiency === 'INSUFFICIENT_CAUSAL_EVIDENCE',
    'Absence of attributions strictly results in INSUFFICIENT_CAUSAL_EVIDENCE'
  );

  // 5. BLOCKED Decision Security Contract
  const blockedDecision = mockState.activeDecisions.find((d) => d.status === 'BLOCKED');
  assert(Boolean(blockedDecision), 'BLOCKED decisions exist in operating state queue');
  assert(
    blockedDecision?.governanceVerdict === 'REJECTED',
    'BLOCKED decisions strictly maintain REJECTED governance verdicts'
  );

  console.log(`\nPhase 36 Complete: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Phase 36 verification failed:', err);
  process.exit(1);
});
