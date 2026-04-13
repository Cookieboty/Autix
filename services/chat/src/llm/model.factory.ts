import { ChatOpenAI, ChatOpenAIFields } from '@langchain/openai';

/**
 * 模型配置缓存：避免每次请求都重新初始化 ChatOpenAI。
 * 键为 modelConfig.id，值为已创建的 ChatOpenAI 实例。
 */
const modelCache = new Map<string, ChatOpenAI>();

export interface ModelFactoryOptions {
  modelConfigId: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  apiKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 按模型配置创建 ChatOpenAI 实例。
 * 优先使用缓存，API Key 变更时重建实例。
 */
export function createChatModel(options: ModelFactoryOptions): ChatOpenAI {
  const {
    modelConfigId,
    modelName,
    temperature = 0.7,
    maxTokens = 2048,
    baseUrl,
    apiKey,
    metadata,
  } = options;

  const cached = modelCache.get(modelConfigId);
  if (cached) return cached;

  const finalApiKey = apiKey ?? (metadata?.apiKey as string | undefined);
  const finalBaseUrl = baseUrl ?? (metadata?.baseUrl as string | undefined);
  const finalTemperature = (metadata?.temperature as number | undefined) ?? temperature;
  const finalMaxTokens = (metadata?.maxTokens as number | undefined) ?? maxTokens;
  const headers = metadata?.headers as Record<string, string> | undefined;

  const modelConfig: ChatOpenAIFields = {
    model: modelName,
    temperature: finalTemperature,
    maxTokens: finalMaxTokens,
  };

  if (finalApiKey) {
    modelConfig.openAIApiKey = finalApiKey;
  }

  if (finalBaseUrl) {
    modelConfig.configuration = { baseURL: finalBaseUrl };
    if (headers) {
      modelConfig.configuration.defaultHeaders = headers;
    }
  }

  const instance = new ChatOpenAI(modelConfig);
  modelCache.set(modelConfigId, instance);
  return instance;
}

/**
 * 根据 ModelConfig 数据库记录创建 ChatOpenAI。
 * 用于 orchestrator 运行时按配置创建模型。
 */
export function createChatModelFromDbConfig(config: {
  id: string;
  model: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  metadata?: unknown;
  type: string;
}): ChatOpenAI {
  const metadata = config.metadata as Record<string, unknown> | null | undefined;
  return createChatModel({
    modelConfigId: config.id,
    modelName: config.model,
    baseUrl: config.baseUrl ?? undefined,
    apiKey: config.apiKey ?? undefined,
    metadata: metadata ?? undefined,
  });
}

/**
 * 清除指定模型的缓存（模型配置更新后调用）
 */
export function invalidateModelCache(modelConfigId: string): void {
  modelCache.delete(modelConfigId);
}
