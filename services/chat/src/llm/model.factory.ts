import { ChatOpenAI } from "@langchain/openai";
import { loadLangChainConfig, getApiKeys } from "../config/load-langchain-config";

export function createChatModel(): ChatOpenAI {
  const config = loadLangChainConfig();
  const keys = getApiKeys();

  return new ChatOpenAI({
    model: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    openAIApiKey: keys.openaiApiKey,
    configuration: {
      baseURL: keys.openaiBaseUrl,
    },
  });
}
