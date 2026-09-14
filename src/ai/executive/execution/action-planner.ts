import { ExecutionStep, ActionProposal } from './types';
import { CapabilityRegistry } from './capability-registry';

export class ExecutionActionPlanner {
  /**
   * Generates an ActionProposal for a READY ExecutionStep.
   */
  static generateProposal(step: ExecutionStep): ActionProposal | null {
    if (step.readiness !== 'READY' && step.readiness !== 'WAITING_FOR_APPROVAL') {
      return null;
    }

    if (!step.requiredCapabilities || step.requiredCapabilities.length === 0) {
      return null;
    }

    // Usually a step corresponds to one primary action capability
    const primaryCapId = step.requiredCapabilities[0];
    const capability = CapabilityRegistry.getCapabilityById(primaryCapId);

    if (!capability || !capability.supported || !capability.actionType) {
      return null;
    }

    // Deterministically map step inputs/details to action parameters.
    // In Phase 44, we just map basic info. A full mapping would extract specific fields.
    const parameters: Record<string, any> = {
      initiativeId: step.initiativeId,
      stepId: step.id,
      title: step.title,
      description: step.description,
    };

    return {
      tool: capability.actionType,
      parameters,
      requiresApproval: capability.requiresApproval,
    };
  }
}
