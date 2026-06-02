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
): Promise<StepProposal> {
  if (remainingSteps.length === 0) {
    return { proposedNextStep: null, reasoning: '所有阶段已完成。' };
  }

  const candidateList = remainingSteps
    .map((s) => `- ${s.stepKey} (${s.displayName}${s.isOptional ? ', 可选' : ''})`)
    .join('\n');

  const result = await model.invoke([
    new SystemMessage(
      `你是工作流调度助手。根据当前阶段的产出，建议下一个最合理的阶段。` +
      `输出 JSON: {"nextStep": "stepKey或null", "reasoning": "理由"}。` +
      `候选阶段（只能从以下选择）:\n${candidateList}`
    ),
    new HumanMessage(
      `刚完成阶段: ${completedStepKey}\n产出摘要: ${artifactSummary.slice(0, 500)}`
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
    reasoning: '按默认顺序继续。',
  };
}
