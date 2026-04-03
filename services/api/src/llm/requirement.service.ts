import { Injectable } from "@nestjs/common";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createChatModel } from "./model.factory";
import { REQUIREMENT_SYSTEM_PROMPT, REQUIREMENT_USER_TEMPLATE } from "./prompts/requirement.prompt";
import { RequirementResultSchema, RequirementResult } from "@repo/contracts";

@Injectable()
export class RequirementService {
  private model = createChatModel();

  async extract(input: string): Promise<RequirementResult> {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", REQUIREMENT_SYSTEM_PROMPT],
      ["human", REQUIREMENT_USER_TEMPLATE],
    ]);

    const messages = await prompt.formatMessages({ input });
    const structuredModel = this.model.withStructuredOutput(RequirementResultSchema);
    const result = await structuredModel.invoke(messages);
    return result as RequirementResult;
  }
}
