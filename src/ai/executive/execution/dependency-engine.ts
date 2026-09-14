import { ExecutionStep } from './types';

export class DependencyEngine {
  /**
   * Validates the dependency graph of an array of ExecutionSteps.
   * Ensures all dependencies exist and there are no circular dependencies.
   */
  static validateDependencyGraph(steps: ExecutionStep[]): 'VALID' | 'MISSING_DEPENDENCY' | 'CYCLE_DETECTED' {
    const stepMap = new Map<string, ExecutionStep>();
    steps.forEach(s => stepMap.set(s.id, s));

    // Check for missing dependencies first
    for (const step of steps) {
      for (const depId of step.dependencies) {
        if (!stepMap.has(depId)) {
          return 'MISSING_DEPENDENCY';
        }
      }
    }

    // Topological sort / cycle detection (Kahn's or DFS)
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (inStack.has(stepId)) return true;
      if (visited.has(stepId)) return false;

      visited.add(stepId);
      inStack.add(stepId);

      const step = stepMap.get(stepId);
      if (step) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      inStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) {
          return 'CYCLE_DETECTED';
        }
      }
    }

    return 'VALID';
  }

  /**
   * Sorts steps in dependency order (topological sort).
   * Assumes the graph is already validated as VALID.
   */
  static sortStepsTopologically(steps: ExecutionStep[]): ExecutionStep[] {
    const stepMap = new Map<string, ExecutionStep>();
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    steps.forEach(s => {
      stepMap.set(s.id, s);
      inDegree.set(s.id, 0);
      adjList.set(s.id, []);
    });

    // Build graph
    // If A depends on B (A -> B), then in terms of execution B must run BEFORE A.
    // So the edge is B -> A
    steps.forEach(s => {
      s.dependencies.forEach(depId => {
        if (adjList.has(depId)) {
          adjList.get(depId)!.push(s.id);
        }
        if (inDegree.has(s.id)) {
          inDegree.set(s.id, inDegree.get(s.id)! + 1);
        }
      });
    });

    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) queue.push(id);
    });

    const sortedSteps: ExecutionStep[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      sortedSteps.push(stepMap.get(currentId)!);

      const neighbors = adjList.get(currentId) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return sortedSteps;
  }
}
