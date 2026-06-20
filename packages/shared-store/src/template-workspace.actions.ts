import {
  appendConversationMessage,
  generationApi,
  imageGenApi,
} from '@autix/sdk';

export type { ModelConfigItem, TemplateVariable } from '@autix/sdk';

export interface ImageGenerationClientConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ImageGenerationRequest extends Record<string, unknown> {
  model: string;
  prompt: string;
  n: number;
  response_format: 'b64_json' | 'url';
}

export interface ImageChatRequest extends Record<string, unknown> {
  model: string;
  messages: unknown[];
  stream: boolean;
}

export interface GenerationTurnInput {
  role: 'USER' | 'ASSISTANT';
  content: string;
  images?: string[];
}

export interface AppendTemplateResultMessageInput {
  content: string;
  metadata?: Record<string, unknown>;
}

export const templateWorkspaceActions = {
  generateImage: (input: ImageGenerationRequest, config: ImageGenerationClientConfig) =>
    imageGenApi.generate(input, config),
  chat: (input: ImageChatRequest, config: ImageGenerationClientConfig) =>
    imageGenApi.chat(input, config),
  addGenerationTurn: (generationId: string, data: GenerationTurnInput) =>
    generationApi.addTurn(generationId, data),
  appendResultToConversation: (
    conversationId: string,
    data: AppendTemplateResultMessageInput,
  ) =>
    appendConversationMessage(conversationId, {
      role: 'USER',
      content: data.content,
      metadata: data.metadata,
    }),
};
