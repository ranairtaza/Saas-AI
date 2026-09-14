import { StrategicInitiative } from './types';
import { Phase43StrategicRecommendation, StrategicPriority, StrategicRisk } from '../strategy/types';
import { InitiativeEngine } from './initiative-engine';
import { ExecutionPlanEngine } from './execution-plan-engine';
import { DependencyEngine } from './dependency-engine';
import { ReadinessEngine } from './readiness-engine';
import { ExecutionActionPlanner } from './action-planner';

export class ExecutiveExecutionService {
  /**
   * Main entry point for Phase 44 orchestration.
   * Maps strategy (priorities, risks, recommendations) into execution plans.
   */
  static planExecution(params: {
    organizationId: string;
    strategy: {
      priorities: StrategicPriority[];
      risks: StrategicRisk[];
      recommendations: Phase43StrategicRecommendation[];
    };
  }): StrategicInitiative[] {
    const { organizationId, strategy } = params;

    // 1. Generate Initiatives for each recommendation
    const initiatives = strategy.recommendations.map(rec => 
      InitiativeEngine.createInitiative({
        recommendation: rec,
        priorities: strategy.priorities,
        risks: strategy.risks,
        organizationId,
      })
    );

    // 2. Generate and validate Execution Plans for each initiative
    for (const initiative of initiatives) {
      const plan = ExecutionPlanEngine.generatePlan(initiative);

      // Validate dependency graph
      plan.dependencyGraph = DependencyEngine.validateDependencyGraph(plan.steps);

      if (plan.dependencyGraph === 'VALID') {
        // Sort steps for sequential evaluation
        plan.steps = DependencyEngine.sortStepsTopologically(plan.steps);

        // Evaluate readiness for all steps
        for (const step of plan.steps) {
          step.readiness = ReadinessEngine.evaluateStepReadiness(step, plan.steps);

          // If a step is READY or WAITING_FOR_APPROVAL, generate its ActionProposal
          if (step.readiness === 'READY' || step.readiness === 'WAITING_FOR_APPROVAL') {
            const proposal = ExecutionActionPlanner.generateProposal(step);
            if (proposal) {
              step.actionProposal = proposal;
            } else {
              // If we failed to generate a proposal for a ready step requiring one, it might be unsupported or missing params
              if (step.requiredCapabilities.length > 0) {
                 step.readiness = 'UNSUPPORTED';
              }
            }
          }
        }

        // Evaluate overall plan readiness based on its steps
        const anyUnsupported = plan.steps.some(s => s.readiness === 'UNSUPPORTED');
        const anyBlocked = plan.steps.some(s => s.readiness === 'BLOCKED');
        const allCompleted = plan.steps.every(s => s.status === 'COMPLETED' || s.status === 'SKIPPED');

        if (anyUnsupported) {
          plan.readiness = 'UNSUPPORTED';
          plan.status = 'FAILED';
          plan.blockers.push('Contains unsupported capabilities');
        } else if (anyBlocked) {
          plan.readiness = 'BLOCKED';
          plan.status = 'BLOCKED';
          plan.blockers.push('Contains blocked steps');
        } else if (allCompleted) {
          plan.readiness = 'COMPLETED';
        } else {
          // If we have valid steps ready to go, the plan is READY_FOR_REVIEW
          // (assuming human must review the DRAFT plan to approve it)
          plan.status = 'READY_FOR_REVIEW';
          plan.readiness = 'READY';
        }
      } else {
        // Graph is invalid
        plan.status = 'FAILED';
        plan.readiness = 'BLOCKED';
        plan.blockers.push(`Invalid dependency graph: ${plan.dependencyGraph}`);
      }

      initiative.executionPlan = plan;
      
      // Update initiative status based on plan
      if (plan.status === 'READY_FOR_REVIEW') {
        initiative.status = 'READY';
      } else if (plan.status === 'FAILED') {
        initiative.status = 'BLOCKED';
      }
    }

    return initiatives;
  }
}
