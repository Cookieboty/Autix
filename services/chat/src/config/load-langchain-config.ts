import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

export interface LlmConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface RetrievalConfig {
  enabled: boolean;
  topK: number;
}

export interface ToolsConfig {
  enableWordCount: boolean;
  enableKeywordExtract: boolean;
}

export interface FeaturesConfig {
  enableStructuredOutput: boolean;
  enableStreaming: boolean;
}

export interface LangChainConfig {
  llm: LlmConfig;
  retrieval: RetrievalConfig;
  tools: ToolsConfig;
  features: FeaturesConfig;
}

export interface ApiKeys {
  embeddingApiKey: string;
  vectorDbUrl: string;
  vectorDbApiKey: string;
}

let cachedConfig: LangChainConfig | null = null;

export function loadLangChainConfig(): LangChainConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.resolve(
    process.cwd(),
    "config",
    "langchain.yaml"
  );
  const fileContents = fs.readFileSync(configPath, "utf8");
  cachedConfig = yaml.load(fileContents) as LangChainConfig;
  return cachedConfig;
}

export function getApiKeys(): ApiKeys {
  return {
    embeddingApiKey: process.env.EMBEDDING_API_KEY ?? "",
    vectorDbUrl: process.env.VECTOR_DB_URL ?? "http://localhost:6333",
    vectorDbApiKey: process.env.VECTOR_DB_API_KEY ?? "",
  };
}
