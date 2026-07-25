export type RemainingWorkflowStep = {
  stepKey: string;
  displayName: string;
  isOptional: boolean;
};

export function buildConstrainedStepPrompt(renderedPrompt: string, stepKey: string): string {
  return renderedPrompt +
    `\n\n[Important constraint] You only need to produce the content for the "${stepKey}" stage. Do not perform tasks for other stages. Stop immediately once the output is complete.`;
}

export function appendRefineFeedback(systemPrompt: string, feedback: string): string {
  if (!feedback) return systemPrompt;
  return `${systemPrompt}\n\n[Revision request] Improve your output based on the following feedback:\n${feedback}`;
}

export function buildNextStepCandidateList(remainingSteps: RemainingWorkflowStep[]): string {
  return remainingSteps
    .map((s) => `- ${s.stepKey} (${s.displayName}${s.isOptional ? ', optional' : ''})`)
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
