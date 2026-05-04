import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface CriticResult {
  score: number;
  passed: boolean;
  feedback: string;
}

/**
 * LLM critic：评估 step 产出质量，返回 0-1 分数和结构化反馈。
 * 仅在 deep 模式且 step.criticEnabled 时调用。
 */
export async function evaluateWithCritic(
  model: BaseChatModel,
  artifactContent: string,
  criticPrompt: string,
  threshold: number,
): Promise<CriticResult> {
  const result = await model.invoke([
    new SystemMessage(criticPrompt),
    new HumanMessage(`请评估以下产出的质量，输出 JSON 格式：{"score": 0.0-1.0, "feedback": "改进建议"}。\n\n---\n${artifactContent}\n---`),
  ]);

  const text = typeof result.content === 'string' ? result.content : '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*"score"[\s\S]*"feedback"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const score = Math.max(0, Math.min(1, Number(parsed.score) || 0));
      return {
        score,
        passed: score >= threshold,
        feedback: String(parsed.feedback || ''),
      };
    }
  } catch { /* parse failed, use defaults */ }

  return { score: 0.5, passed: 0.5 >= threshold, feedback: text.slice(0, 500) };
}
