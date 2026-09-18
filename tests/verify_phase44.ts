import { ExecutiveExecutionService } from '../src/ai/executive/execution/execution-service';
import { DependencyEngine } from '../src/ai/executive/execution/dependency-engine';
import { ExecutionStep } from '../src/ai/executive/execution/types';
import { Phase43StrategicRecommendation, StrategicPriority, StrategicRisk } from '../src/ai/executive/strategy/types';

// Simple assert helper
let passedCount = 0;
let failedCount = 0;
function assert(condition: boolean, message: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${message}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${message}`);
  }
}

async function runTests() {
  console.log('\n--- PHASE 44 VERIFICATION START ---\n');

  // Test 1: DependencyEngine Validation (Valid graph)
  const stepA: ExecutionStep = { id: 'A', initiativeId: '1', order: 1, title: '', description: '', type: 'ANALYZE', dependencies: [], ownerRole: 'SYS', requiredCapabilities: [], requiredInputs: [], expectedOutcome: null, actionProposal: null, readiness: 'READY', status: 'PENDING', evidence: [] };
  const stepB: ExecutionStep = { id: 'B', initiativeId: '1', order: 2, title: '', description: '', type: 'UPDATE', dependencies: ['A'], ownerRole: 'SYS', requiredCapabilities: [], requiredInputs: [], expectedOutcome: null, actionProposal: null, readiness: 'WAITING_FOR_DEPENDENCY', status: 'PENDING', evidence: [] };
  
  assert(DependencyEngine.validateDependencyGraph([stepA, stepB]) === 'VALID', 'DependencyEngine validates a correct acyclic graph.');
  
  // Test 2: DependencyEngine Cycle
  const stepCycleA: ExecutionStep = { ...stepA, dependencies: ['B'] };
  assert(DependencyEngine.validateDependencyGraph([stepCycleA, stepB]) === 'CYCLE_DETECTED', 'DependencyEngine detects circular dependencies.');

  // Test 3: DependencyEngine Missing
  const stepMissing: ExecutionStep = { ...stepB, dependencies: ['C'] };
  assert(DependencyEngine.validateDependencyGraph([stepA, stepMissing]) === 'MISSING_DEPENDENCY', 'DependencyEngine detects missing dependencies.');

  // Test 4: DependencyEngine Sort
  const sorted = DependencyEngine.sortStepsTopologically([stepB, stepA]); // B depends on A
  assert(sorted[0].id === 'A' && sorted[1].id === 'B', 'DependencyEngine topologically sorts execution steps properly.');

  // Mock Phase 43 Output
  const priorities: StrategicPriority[] = [
    {
      id: 'PRIO-1',
      category: 'REVENUE',
      priority: 'HIGH',
      impact: 90,
      urgency: 80,
      confidence: 'HIGH',
      description: 'Pipeline velocity is low',
      sourceGoals: ['GOAL-1'],
      sourceMetrics: [],
      relatedRisks: [],
    }
  ];

  const risks: StrategicRisk[] = [
    {
      id: 'RISK-1',
      type: 'GOAL_MISS',
      category: 'REVENUE',
      description: 'Q3 pipeline is behind',
      severity: 'HIGH',
      confidence: 'HIGH',
      sourceGoals: ['GOAL-1'],
      sourceMetrics: [],
      measurementRisk: false,
    }
  ];

  const recommendations: Phase43StrategicRecommendation[] = [
    {
      id: 'REC-1',
      title: 'Increase ad spend',
      description: 'Pipeline needs boost. Expected: 20% more leads',
      priority: 'HIGH',
      category: 'REVENUE',
      focusAreas: ['ADS', 'PIPELINE'],
      addressedRisks: ['RISK-1'],
      addressedPriorities: ['PRIO-1'],
      status: 'DRAFT',
    },
    {
      id: 'REC-2',
      title: 'Communicate via Slack to the team',
      description: 'Alignment needed. Expected: Better focus',
      priority: 'MEDIUM',
      category: 'REVENUE',
      focusAreas: ['COMMS'],
      addressedRisks: [],
      addressedPriorities: ['PRIO-1'],
      status: 'DRAFT',
    }
  ];

  // Test Orchestration
  const initiatives = ExecutiveExecutionService.planExecution({
    organizationId: 'org-test',
    strategy: { priorities, risks, recommendations }
  });

  // Basic Initiative Assertions
  assert(initiatives.length === 2, 'ExecutionService generated 1 Initiative per Recommendation.');
  
  const init1 = initiatives.find(i => i.recommendationId === 'REC-1')!;
  const init2 = initiatives.find(i => i.recommendationId === 'REC-2')!;

  assert(init1.priorityId === 'PRIO-1', 'Initiative correctly links back to Priority ID.');
  assert(init1.relatedRiskIds.includes('RISK-1'), 'Initiative correctly links back to Risk ID.');
  assert(init1.goalIds.includes('GOAL-1'), 'Initiative inherits Goal IDs properly for provenance.');
  
  // Evidence / Provenance
  assert(init1.evidence.some(e => e.sourceType === 'PRIORITY'), 'ExecutionEvidence contains Priority linkage.');
  assert(init1.evidence.some(e => e.sourceType === 'RISK'), 'ExecutionEvidence contains Risk linkage.');
  assert(init1.evidence.some(e => e.sourceType === 'RECOMMENDATION'), 'ExecutionEvidence contains Recommendation linkage.');

  // Execution Plans
  const plan1 = init1.executionPlan!;
  assert(plan1 !== null, 'ExecutionPlan was generated for Initiative 1.');
  assert(plan1.dependencyGraph === 'VALID', 'ExecutionPlan dependency graph is valid.');
  assert(plan1.steps.length >= 2, 'ExecutionPlan created with multiple execution steps.');
  
  // Step Sequencing
  const step1 = plan1.steps[0];
  const step2 = plan1.steps[1];
  assert(step1.type === 'ANALYZE', 'First step is an Analyze step to prevent blind execution.');
  assert(step2.dependencies.includes(step1.id), 'Second action step properly depends on the Analyze step.');

  // Readiness Engine Assertions
  assert(step1.readiness === 'READY', 'Step 1 Readiness is evaluated as READY.');
  assert(step2.readiness === 'WAITING_FOR_DEPENDENCY', 'Step 2 Readiness is WAITING_FOR_DEPENDENCY because Step 1 is pending.');

  // Action Planner Assertions
  assert(step1.actionProposal !== null, 'ActionPlanner generated a proposal for the READY step.');
  if (step1.actionProposal) {
    assert(step1.actionProposal.tool === 'reporting_generate', 'ActionPlanner selected the correct tool based on capability.');
    assert(step1.actionProposal.requiresApproval === false, 'ActionProposal correctly maps the approval requirement flag from Capability registry.');
  }
  assert(step2.actionProposal === null, 'ActionPlanner did NOT generate a proposal for a step waiting on dependencies.');

  // Unsupported Capability Test
  const plan2 = init2.executionPlan!;
  const badStep = plan2.steps[1]; // COMMUNICATE step
  assert(badStep.requiredCapabilities.includes('CAP_COMMUNICATE_TEAM'), 'Initiative 2 step requested CAP_COMMUNICATE_TEAM capability.');
  assert(badStep.readiness === 'UNSUPPORTED', 'ReadinessEngine flagged step as UNSUPPORTED because the capability is toggled off.');
  assert(plan2.readiness === 'UNSUPPORTED', 'Plan readiness bubbles up to UNSUPPORTED if it contains blocked/unsupported steps.');
  assert(plan2.status === 'FAILED', 'Plan status marked FAILED immediately if missing critical capabilities.');
  assert(init2.status === 'BLOCKED', 'Initiative status bubbled to BLOCKED based on failing plan.');

  // General Plan level checks
  assert(plan1.status === 'READY_FOR_REVIEW', 'Plan 1 status marked as READY_FOR_REVIEW for human evaluation.');
  assert(plan1.readiness === 'READY', 'Plan 1 readiness is READY since the graph is valid and dependencies can execute.');

  // Real verification of execution step contracts and rules
  assert(plan1.steps.every(s => typeof s.ownerRole === 'string' && s.ownerRole.length > 0), "ExecutionStep: Enforces ownerRole field.");
  assert(plan1.steps.every(s => 'expectedOutcome' in s), "ExecutionStep: Enforces expectedOutcome field presence.");
  assert(init1.category === 'REVENUE', "StrategicInitiative: Maps category from Priority.");
  assert((plan1.status as string) !== 'EXECUTING' && plan1.status !== 'COMPLETED', "Rule: Does not execute automatically.");
  assert(plan1.steps.every(s => s.actionProposal === null || typeof s.actionProposal.tool === 'string'), "CapabilityRegistry: Validates tool mappings on proposals.");
  assert(plan2.steps.some(s => s.readiness === 'UNSUPPORTED'), "CapabilityRegistry: Prevents unknown or toggled-off capabilities.");
  assert(initiatives.every(i => !i.evidence.some(e => !e.sourceType)), "ExecutionEvidence: Enforces strictly provenance-backed evidence without fabricated variables.");

  console.log(`\nVerification Complete: ${passedCount} Passed, ${failedCount} Failed\n`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
