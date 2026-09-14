import { ExecutionStep, ExecutionStepReadiness } from './types';
import { CapabilityRegistry } from './capability-registry';

export class ReadinessEngine {
  /**
   * Evaluates the readiness of a specific ExecutionStep given the state of all steps in the plan.
   */
  static evaluateStepReadiness(step: ExecutionStep, allSteps: ExecutionStep[]): ExecutionStepReadiness {
    // 1. Check if capabilities are supported
    if (step.requiredCapabilities && step.requiredCapabilities.length > 0) {
      for (const capId of step.requiredCapabilities) {
        const cap = CapabilityRegistry.getCapabilityById(capId);
        if (!cap || !cap.supported) {
          return 'UNSUPPORTED';
        }
      }
    }

    // 2. Check dependencies
    if (step.dependencies && step.dependencies.length > 0) {
      for (const depId of step.dependencies) {
        const depStep = allSteps.find(s => s.id === depId);
        if (!depStep) {
          return 'BLOCKED'; // Missing dependency in the array
        }
        if (depStep.status !== 'COMPLETED' && depStep.status !== 'SKIPPED') {
          return 'WAITING_FOR_DEPENDENCY';
        }
      }
    }

    // 3. Check for explicitly required inputs (mocked here, assume if missing we block)
    // For Phase 44 purposes, if there are inputs required but no source provided, it might be missing
    // We'll assume if requiredInputs has items, we need them resolved. Let's just say if it's "manual_input", it's MISSING_INPUT
    if (step.requiredInputs.includes('MANUAL_INPUT_REQUIRED')) {
       return 'MISSING_INPUT';
    }

    // 4. If action proposal requires approval and status is pending, maybe WAITING_FOR_APPROVAL
    // But initially, if we just planned it, it's READY to be proposed.
    // If the step has been mapped to an action proposal and requires approval, we might need a distinct state.
    // However, the action engine handles the approval. The step itself is 'READY' to be processed by the ActionEngine.
    
    return 'READY';
  }
}
