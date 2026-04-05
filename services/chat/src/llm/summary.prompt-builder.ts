import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SUMMARY_SYSTEM_PROMPT, SUMMARY_USER_TEMPLATE } from "./prompts/summary.prompt";

/**
 * Build summary prompt using ChatPromptTemplate.fromMessages()
 */
export function buildSummaryPrompt(): ChatPromptTemplate {
  return ChatPromptTemplate.fromMessages([
    ["system", SUMMARY_SYSTEM_PROMPT],
    ["human", SUMMARY_USER_TEMPLATE],
  ]);
}
