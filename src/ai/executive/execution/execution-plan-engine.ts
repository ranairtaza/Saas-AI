import { ExecutionPlan, StrategicInitiative, ExecutionStep, ExecutionEvidence, ExecutionPlanStatus } from './types';
import * as crypto from 'crypto';
import { CapabilityRegistry } from './capability-registry';

export class ExecutionPlanEngine {
  /**
   * Deterministically generates an ExecutionPlan from a StrategicInitiative.
   */
  static generatePlan(initiative: StrategicInitiative): ExecutionPlan {
    const steps = this.generateStepsForInitiative(initiative);
    
    // Status should be DRAFT unless further governed
    const status: ExecutionPlanStatus = 'DRAFT';

    return {
      id: `PLAN-${crypto.randomUUID()}`,
      initiativeId: initiative.id,
      status,
      steps,
      dependencyGraph: 'VALID', // Initial assignment; actual validation by DependencyEngine
      readiness: 'BLOCKED', // Evaluated properly later by ReadinessEngine
      blockers: [],
      evidence: initiative.evidence,
    };
  }

  private static generateStepsForInitiative(initiative: StrategicInitiative): ExecutionStep[] {
    const steps: ExecutionStep[] = [];

    // Simple deterministic mapping based on category or priority for Phase 44 rules
    const analyzeStepId = `STEP-ANA-${crypto.randomUUID()}`;
    const actionStepId = `STEP-ACT-${crypto.randomUUID()}`;

    // Common Step 1: Analyze / Review
    steps.push({
      id: analyzeStepId,
      initiativeId: initiative.id,
      order: 1,
      title: `Analyze data for ${initiative.title}`,
      description: 'Review supporting data and forecast context before taking action.',
      type: 'ANALYZE',
      dependencies: [],
      ownerRole: 'SYSTEM',
      requiredCapabilities: ['CAP_REPORTING_GENERATE'],
      requiredInputs: [],
      expectedOutcome: 'Analysis complete',
      actionProposal: null,
      readiness: 'READY',
      status: 'PENDING',
      evidence: [],
    });

    // Step 2: The actual action mapping (Simplified deterministic mapping for Phase 44 logic)
    let primaryCapId = 'CAP_SYSTEM_UPDATE_GOAL';
    let type: any = 'UPDATE';

    if (initiative.category === 'REVENUE' || initiative.category === 'GROWTH') {
      primaryCapId = 'CAP_CRM_UPDATE_LEAD';
      type = 'UPDATE';
    } else if (initiative.category === 'OPERATIONS') {
      primaryCapId = 'CAP_SYSTEM_UPDATE_GOAL';
    }

    const fullText = (initiative.title + ' ' + initiative.description + ' ' + initiative.objective).toLowerCase();
    
    if (fullText.includes('communicate') || fullText.includes('slack')) {
      primaryCapId = 'CAP_COMMUNICATE_TEAM';
      type = 'COMMUNICATE';
    }

    steps.push({
      id: actionStepId,
      initiativeId: initiative.id,
      order: 2,
      title: `Execute main action: ${initiative.category}`,
      description: initiative.description,
      type,
      dependencies: [analyzeStepId],
      ownerRole: 'SYSTEM',
      requiredCapabilities: [primaryCapId],
      requiredInputs: [],
      expectedOutcome: initiative.expectedOutcome || 'Action completed',
      actionProposal: null,
      readiness: 'WAITING_FOR_DEPENDENCY',
      status: 'PENDING',
      evidence: [],
    });

    return steps;
  }
}
