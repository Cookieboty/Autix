export type WorkflowPlanStep = {
  stepKey: string;
  dependencies: string[];
  isOptional?: boolean;
};

export function computeExecutionPlan(
  allSteps: WorkflowPlanStep[],
  targetStepKey?: string | null,
): string[] {
  const stepMap = new Map(allSteps.map((step) => [step.stepKey, step]));

  if (targetStepKey && stepMap.has(targetStepKey)) {
    const needed = new Set<string>();
    const collect = (key: string) => {
      if (needed.has(key)) return;
      needed.add(key);
      const step = stepMap.get(key);
      if (!step) return;
      for (const dependency of step.dependencies) {
        collect(dependency);
      }
    };

    collect(targetStepKey);

    return topoSort(allSteps.filter((step) => needed.has(step.stepKey)));
  }

  return topoSort(allSteps);
}

function topoSort(steps: Array<{ stepKey: string; dependencies: string[] }>): string[] {
  const inDegree = new Map<string, number>();
  const adjacent = new Map<string, string[]>();
  const stepSet = new Set(steps.map((step) => step.stepKey));

  for (const step of steps) {
    inDegree.set(step.stepKey, 0);
    adjacent.set(step.stepKey, []);
  }

  for (const step of steps) {
    for (const dependency of step.dependencies) {
      if (!stepSet.has(dependency)) continue;
      adjacent.get(dependency)!.push(step.stepKey);
      inDegree.set(step.stepKey, (inDegree.get(step.stepKey) ?? 0) + 1);
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([key]) => key);
  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const next of adjacent.get(current) ?? []) {
      const newDegree = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDegree);
      if (newDegree === 0) queue.push(next);
    }
  }

  return result;
}
