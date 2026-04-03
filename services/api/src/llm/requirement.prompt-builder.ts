import { ChatPromptTemplate } from "@langchain/core/prompts";
import { REQUIREMENT_SYSTEM_PROMPT, REQUIREMENT_USER_TEMPLATE } from "./prompts/requirement.prompt";

/**
 * Build requirement prompt using ChatPromptTemplate.fromMessages()
 */
export function buildRequirementPrompt(): ChatPromptTemplate {
  return ChatPromptTemplate.fromMessages([
    ["system", REQUIREMENT_SYSTEM_PROMPT],
    ["human", REQUIREMENT_USER_TEMPLATE],
  ]);
}
