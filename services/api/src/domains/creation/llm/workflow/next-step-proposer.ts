import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface StepProposal {
  proposedNextStep: string | null;
  reasoning: string;
}

/**
 * Step 完成时由 LLM 输出下一步建议。候选集合限制：只能选已定义的下游 step。
 */
export async function proposeNextStep(
  model: BaseChatModel,
  completedStepKey: string,
  remainingSteps: Array<{ stepKey: string; displayName: string; isOptional: boolean }>,
  artifactSummary: string,
  systemPrompt: string,
): Promise<StepProposal> {
  if (remainingSteps.length === 0) {
    return { proposedNextStep: null, reasoning: 'All stages are complete.' };
  }

  const result = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Just completed stage: ${completedStepKey}\nOutput summary: ${artifactSummary.slice(0, 500)}`
    ),
  ]);

  const text = typeof result.content === 'string' ? result.content : '';

  try {
    const match = text.match(/\{[\s\S]*"nextStep"[\s\S]*"reasoning"[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const proposed = parsed.nextStep;
      const valid = proposed === null || remainingSteps.some((s) => s.stepKey === proposed);
      return {
        proposedNextStep: valid ? proposed : remainingSteps[0].stepKey,
        reasoning: String(parsed.reasoning || ''),
      };
    }
  } catch { /* parse failed */ }

  return {
    proposedNextStep: remainingSteps[0].stepKey,
    reasoning: 'Continue in default order.',
  };
}
