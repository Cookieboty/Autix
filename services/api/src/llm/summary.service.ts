import { Injectable } from "@nestjs/common";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createChatModel } from "./model.factory";
import { SUMMARY_SYSTEM_PROMPT, SUMMARY_USER_TEMPLATE } from "./prompts/summary.prompt";
import { SummaryResultSchema, SummaryResult } from "@repo/contracts";

@Injectable()
export class SummaryService {
  private model = createChatModel();

  async summarize(input: string): Promise<SummaryResult> {
    // System prompt: base role + field return requirements
    const systemPromptWithFields = `${SUMMARY_SYSTEM_PROMPT}

请按以下字段格式返回结果：
- summary: 整理后的正文
- confidence: low | medium | high
- keywords: 关键词数组`;

    // Build prompt using ChatPromptTemplate.fromMessages()
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPromptWithFields],
      ["human", SUMMARY_USER_TEMPLATE],
    ]);

    // Generate messages array
    const messages = await prompt.formatMessages({ input });

    // Create structured model and invoke
    const structuredModel = this.model.withStructuredOutput(SummaryResultSchema);
    const result = await structuredModel.invoke(messages);
    return result as SummaryResult;
  }
}
