import type { StreamMessage } from '@autix/domain/ai-ui';
import { AgentKind, MessageRole } from '../../platform/prisma/generated';
import type {
  GenerateAndPersistImageResult,
  ResolveImageRequestInput,
} from '../llm/workflow/image-generation-flow.service';
import type {
  ImageGenerationSettings,
  ResolvedImageRequest,
  SourceImageRef,
} from '../llm/workflow/image-generation-call-params';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';

export type ChatAttachmentKind = 'image' | 'video' | 'audio' | 'file';

export interface ChatAttachmentBody {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: ChatAttachmentKind;
}

export interface ImageGenerationBody {
  model: string;
  chatModelId?: string;
  n?: number;
  templateId: string;
  variables?: Record<string, string>;
  promptOverride?: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  editInstruction?: string;
  settings?: ImageGenerationSettings;
}

export interface ChatSourceImagesOptions {
  sourceImages?: SourceImageRef[];
}

export interface ChatRequestPayload extends ChatSourceImagesOptions {
  message: string;
  modelId?: string;
  images?: string[];
  attachments?: ChatAttachmentBody[];
}

export interface NormalizedChatRequest {
  message: string;
  attachments: ChatAttachmentBody[];
  imageUrls: string[];
  requestHash: string;
  userMetadata?: {
    images?: string[];
    attachments?: ChatAttachmentBody[];
  };
  streamOptions: {
    images: string[];
    sourceImages?: SourceImageRef[];
  };
}

export interface ProcessingRequestSnapshot {
  hash: string;
  timestamp: number;
}

export interface StreamPersistenceDraft {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface GenerateImageStreamContext {
  userId: string;
  conversationId: string;
  body: ImageGenerationBody;
}

export function isChatAttachmentKind(value: unknown): value is ChatAttachmentKind {
  return value === 'image' || value === 'video' || value === 'audio' || value === 'file';
}

export function parseAgentKind(value: unknown): AgentKind | undefined {
  return typeof value === 'string' && (Object.values(AgentKind) as string[]).includes(value)
    ? (value as AgentKind)
    : undefined;
}

export function parsePositiveInt(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function resolveMessageRole(value: unknown): MessageRole {
  return value === 'ASSISTANT' ? MessageRole.ASSISTANT : MessageRole.USER;
}

export function isChatAttachmentBody(value: unknown): value is ChatAttachmentBody {
  if (value == null || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.url === 'string' &&
    typeof item.name === 'string' &&
    typeof item.mimeType === 'string' &&
    typeof item.size === 'number' &&
    Number.isFinite(item.size) &&
    isChatAttachmentKind(item.kind)
  );
}

export function sanitizeChatAttachments(value: unknown): ChatAttachmentBody[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isChatAttachmentBody)
    .map((item) => ({
      url: item.url,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      kind: item.kind,
    }));
}

export function sanitizeChatImageUrls(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((url): url is string => typeof url === 'string')
    : [];
}

export function normalizeChatMessage(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function buildProcessingRequestHash(
  message: string,
  imageUrls: string[],
  attachments: ChatAttachmentBody[],
): string {
  const attachmentHash = attachments
    .map((attachment) => attachment.url)
    .join('|')
    .slice(0, 256);
  return `${message.length}:${message.slice(0, 64)}:${imageUrls.length}:${imageUrls.join('|').slice(0, 256)}:${attachments.length}:${attachmentHash}`;
}

export function normalizeChatRequest(body: ChatRequestPayload): NormalizedChatRequest {
  const message = normalizeChatMessage(body.message);
  const attachments = sanitizeChatAttachments(body.attachments);
  const imageUrls = sanitizeChatImageUrls(body.images);
  const requestHash = buildProcessingRequestHash(message, imageUrls, attachments);

  return {
    message,
    attachments,
    imageUrls,
    requestHash,
    userMetadata: buildChatUserMetadata(imageUrls, attachments),
    streamOptions: {
      images: imageUrls,
      sourceImages: body.sourceImages,
    },
  };
}

export function isDuplicateProcessingRequest(
  existing: ProcessingRequestSnapshot | undefined,
  requestHash: string,
  now: number,
): boolean {
  return Boolean(existing && existing.hash === requestHash && (now - existing.timestamp) < 10000);
}

export function buildChatUserMetadata(
  imageUrls: string[],
  attachments: ChatAttachmentBody[],
): NormalizedChatRequest['userMetadata'] {
  return imageUrls.length > 0 || attachments.length > 0
    ? {
      ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    }
    : undefined;
}

export function asConversationRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function formatConversationMessage(msg: {
  id: string;
  role: unknown;
  content: string;
  createdAt: Date;
  metadata?: unknown;
}) {
  const metadata = asConversationRecord(msg.metadata);
  const messageType = metadata?.messageType || 'markdown';

  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    messageType,
    createdAt: msg.createdAt,
    timestamp: msg.createdAt,
    durationMs:
      typeof metadata?.durationMs === 'number' ? metadata.durationMs : undefined,
    metadata: {
      ...(metadata ?? {}),
      uiStage: metadata?.uiStage,
      retrievedDocuments: metadata?.retrievedDocuments,
    },
  };
}

export function resolveImageGenerationCount(value: unknown): number {
  return Math.max(1, Math.min((value as number | null | undefined) ?? 1, 4));
}

export function buildImageGenerationTaskId(now = Date.now()): string {
  return `img-${now}`;
}

export function buildImageResolveInput(
  context: GenerateImageStreamContext,
): ResolveImageRequestInput {
  const { userId, conversationId, body } = context;
  return {
    userId,
    conversationId,
    templateId: body.templateId,
    modelConfigId: body.model,
    chatModelId: body.chatModelId,
    variables: body.variables,
    promptOverride: body.promptOverride,
    sourceImages: body.sourceImages,
    referenceImages: body.referenceImages,
    editInstruction: body.editInstruction,
    settings: body.settings,
  };
}

export function buildImagePersistInput(
  context: GenerateImageStreamContext,
): ResolveImageRequestInput {
  const { userId, conversationId, body } = context;
  return {
    userId,
    conversationId,
    templateId: body.templateId,
    modelConfigId: body.model,
    variables: body.variables,
    promptOverride: body.promptOverride,
    sourceImages: body.sourceImages,
    referenceImages: body.referenceImages,
    editInstruction: body.editInstruction,
    settings: body.settings,
  };
}

export function buildImageStartStreamMessage(
  taskId: string,
  request: ResolvedImageRequest,
  count: number,
  timestamp = new Date().toISOString(),
): StreamMessage {
  return {
    messageType: request.mode === 'edit' ? 'image_editing' : 'image_generating',
    timestamp,
    payload: {
      taskId,
      model: request.modelConfig.model,
      count,
      sourceImages: request.sourceImages,
    },
  } as StreamMessage;
}

export function buildImageResultStreamMessage(
  taskId: string,
  request: ResolvedImageRequest,
  result: GenerateAndPersistImageResult,
  timestamp = new Date().toISOString(),
): StreamMessage {
  return {
    messageType: 'image_result',
    timestamp,
    payload: {
      taskId,
      images: result.images,
      prompt: result.prompt,
      model: result.model,
      sourceImages: request.sourceImages,
      referenceImages: request.referenceImages,
      appliedSettings: result.appliedSettings,
    },
  } as StreamMessage;
}

export function buildDoneStreamMessage(
  durationMs?: number,
  timestamp = new Date().toISOString(),
): StreamMessage {
  return {
    messageType: 'done',
    timestamp,
    payload: durationMs == null ? null : ({ durationMs } as unknown as null),
  } as StreamMessage;
}

export function buildErrorStreamMessage(
  err: unknown,
  timestamp = new Date().toISOString(),
): StreamMessage {
  return {
    messageType: 'error',
    timestamp,
    payload: { error: err instanceof Error ? err.message : 'Unknown error' },
  } as StreamMessage;
}

export function buildDuplicateProcessingStreamError() {
  return { type: 'error', message: '请求正在处理中' };
}

export function collectStreamPersistence(
  draft: StreamPersistenceDraft,
  event: WorkflowStepEvent,
): StreamPersistenceDraft {
  if (event.type === 'llm_token') {
    return {
      ...draft,
      content: `${draft.content}${event.content}`,
    };
  }

  if (event.type === 'prompt_suggestion') {
    return {
      content: event.prompt,
      metadata: {
        messageType: 'prompt_suggestion',
        prompt: event.prompt,
        model: event.model,
        reasoning: event.reasoning,
      },
    };
  }

  if (event.type === 'edit_suggestion') {
    return {
      content: event.instruction,
      metadata: {
        messageType: 'edit_suggestion',
        instruction: event.instruction,
        sourceImages: event.sourceImages,
        model: event.model,
        reasoning: event.reasoning,
      },
    };
  }

  return draft;
}

export function appendStreamTokenContent(content: string, event: WorkflowStepEvent): string {
  return event.type === 'llm_token' ? `${content}${event.content}` : content;
}

export function buildAssistantMessageMetadata(
  metadata: Record<string, unknown> | undefined,
  durationMs: number,
): Record<string, unknown> {
  return {
    ...(metadata ?? { messageType: 'markdown' }),
    durationMs,
  };
}
