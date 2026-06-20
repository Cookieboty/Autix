export type RemainingWorkflowStep = {
  stepKey: string;
  displayName: string;
  isOptional: boolean;
};

export function buildConstrainedStepPrompt(renderedPrompt: string, stepKey: string): string {
  return renderedPrompt +
    `\n\n【重要约束】你只需要产出 "${stepKey}" 阶段的内容。不要执行其他阶段的任务。产出完成后立即停止。`;
}

export function appendRefineFeedback(systemPrompt: string, feedback: string): string {
  if (!feedback) return systemPrompt;
  return `${systemPrompt}\n\n【修改要求】根据以下反馈改进你的产出：\n${feedback}`;
}

export function buildNextStepCandidateList(remainingSteps: RemainingWorkflowStep[]): string {
  return remainingSteps
    .map((s) => `- ${s.stepKey} (${s.displayName}${s.isOptional ? ', 可选' : ''})`)
    .join('\n');
}

export function buildNextStepOptions(
  remainingSteps: RemainingWorkflowStep[],
): ('continue' | 'stop' | 'retry' | 'jump_to')[] {
  const nextOptions: ('continue' | 'stop' | 'retry' | 'jump_to')[] = [
    'continue',
    'stop',
    'retry',
  ];
  if (remainingSteps.length > 1) nextOptions.push('jump_to');
  return nextOptions;
}
