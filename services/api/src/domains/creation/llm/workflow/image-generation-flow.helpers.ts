import { type MessageRole } from '../../../platform/prisma/generated';
import type {
  ImageGenerationSettings,
  ResolvedImageRequest,
  SourceImageRef,
} from './image-generation-call-params';

const IMAGE_DATA_URL_RE = /^data:image\/(\w+);base64,/i;

export function asImageFlowRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

export function buildImageConversationSummary(
  messages: Array<{
    role: MessageRole | 'USER' | 'ASSISTANT';
    content: string;
    metadata?: unknown;
  }>,
): string {
  const lines: string[] = [];
  const recentUserMessages = messages
    .filter((m) => String(m.role) === 'USER')
    .slice(-3);

  for (const message of messages) {
    const metadata = asImageFlowRecord(message.metadata);
    const messageType = metadata?.messageType;

    if (String(message.role) === 'USER') {
      if (recentUserMessages.includes(message)) {
        lines.push(`User: ${message.content}`);
      }
      continue;
    }

    if (messageType === 'prompt_suggestion' && typeof metadata?.prompt === 'string') {
      lines.push(`Prompt suggestion: ${metadata.prompt}`);
    }

    if (messageType === 'edit_suggestion' && typeof metadata?.instruction === 'string') {
      lines.push(`Edit suggestion: ${metadata.instruction}`);
    }

    if (messageType === 'image_result') {
      if (typeof metadata?.prompt === 'string') {
        lines.push(`Generated prompt: ${metadata.prompt}`);
      }
      const images = Array.isArray(metadata?.images) ? metadata.images : [];
      for (const image of images) {
        const imageRecord = asImageFlowRecord(image);
        if (typeof imageRecord?.url === 'string') {
          lines.push(
            `Generated image: ${imageRecord.url}${typeof imageRecord.prompt === 'string'
              ? ` | prompt: ${imageRecord.prompt}`
              : ''
            }`,
          );
        }
      }
    }
  }

  return lines.join('\n').slice(0, 12000);
}

export function shouldTuneWorkbenchPrompt(settings?: ImageGenerationSettings): boolean {
  if (!settings) return false;
  if (settings.skipPromptTuning === true) return false;
  const promptTuning = String(settings.promptTuning ?? '');
  return Boolean(promptTuning && promptTuning !== '忠实原文');
}

export function isImageDataUrl(value: string | undefined | null): value is string {
  return typeof value === 'string' && IMAGE_DATA_URL_RE.test(value);
}

export function formatPromptImageRef(
  img: SourceImageRef,
  index: number,
  promptLabel: string,
): string {
  const url = isImageDataUrl(img.url)
    ? `[uploaded image data: ${img.url.slice(0, 32)}...]`
    : img.url;
  return `${index + 1}. ${url}${img.prompt ? ` | ${promptLabel}: ${img.prompt}` : ''}`;
}

export function collectPromptImageUrls(
  sourceImages?: SourceImageRef[],
  referenceImages?: SourceImageRef[],
): string[] {
  return [
    ...(sourceImages ?? []),
    ...(referenceImages ?? []),
  ].map((img) => img.url);
}

export function findLastGeneratedPrompt(
  messages: Array<{ metadata?: unknown }>,
): string | undefined {
  for (const message of [...messages].reverse()) {
    const metadata = asImageFlowRecord(message.metadata);
    if (
      metadata?.messageType === 'image_result' &&
      typeof metadata.prompt === 'string'
    ) {
      return metadata.prompt;
    }
  }
  return undefined;
}

export function normalizeImageQuality(value: unknown): 'low' | 'medium' | 'high' {
  const quality = String(value ?? 'medium').toLowerCase();
  if (quality.includes('low')) return 'low';
  if (quality.includes('high') || quality.includes('hd')) return 'high';
  return 'medium';
}

export function resolveImagePricingTaskType(request: ResolvedImageRequest): string {
  const quality = normalizeImageQuality(request.settings?.quality);
  if (quality === 'low') return 'gpt_image_2_low';
  if (quality === 'high') return 'gpt_image_2_high';
  return 'gpt_image_2_medium';
}

export function formatBillingModel(
  provider: string | null | undefined,
  model: string,
): string {
  return [provider, model].filter(Boolean).join('/') || model;
}

export interface ImageFlowTemplateLike {
  prompt: string;
  title?: string | null;
}

export interface WorkbenchPromptPayload {
  userText: string;
  imageUrls: string[];
}

export function buildPromptSummaryPayload(input: {
  mode: 'generate' | 'edit';
  template: ImageFlowTemplateLike;
  variables: Record<string, string>;
  conversationSummary: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  editInstruction?: string;
  lastGeneratedPrompt?: string;
}): WorkbenchPromptPayload {
  const sourceImages = input.sourceImages
    ?.map((img, index) => formatPromptImageRef(img, index, 'original prompt'))
    .join('\n');
  const referenceImages = input.referenceImages
    ?.map((img, index) => formatPromptImageRef(img, index, 'reference note'))
    .join('\n');

  return {
    userText: [
      `Mode: ${input.mode}`,
      `Template title: ${input.template.title ?? ''}`,
      `Template prompt: ${input.template.prompt}`,
      `Variables: ${JSON.stringify(input.variables)}`,
      input.lastGeneratedPrompt
        ? `Last generated prompt: ${input.lastGeneratedPrompt}`
        : '',
      sourceImages ? `Source images:\n${sourceImages}` : '',
      referenceImages
        ? `Reference images (visual guidance only, not edit targets):\n${referenceImages}`
        : '',
      input.editInstruction
        ? `Latest edit instruction: ${input.editInstruction}`
        : '',
      `Conversation summary:\n${input.conversationSummary}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    imageUrls: collectPromptImageUrls(input.sourceImages, input.referenceImages),
  };
}

export function buildPromptRefinementPayload(input: {
  mode: 'generate' | 'edit';
  template: ImageFlowTemplateLike;
  prompt: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: ImageGenerationSettings;
}): WorkbenchPromptPayload {
  const sourceImages = input.sourceImages
    ?.map((img, index) => formatPromptImageRef(img, index, 'source prompt'))
    .join('\n');
  const referenceImages = input.referenceImages
    ?.map((img, index) => formatPromptImageRef(img, index, 'reference note'))
    .join('\n');

  return {
    userText: [
      `Mode: ${input.mode}`,
      `Template title: ${input.template.title ?? ''}`,
      `Template prompt: ${input.template.prompt}`,
      `User prompt:\n${input.prompt}`,
      `Prompt tuning: ${input.settings?.promptTuning ?? ''}`,
      `Style preset: ${input.settings?.stylePreset ?? ''}`,
      `Negative prompt: ${input.settings?.negativePrompt ?? ''}`,
      sourceImages ? `Source images:\n${sourceImages}` : '',
      referenceImages ? `Reference images:\n${referenceImages}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    imageUrls: collectPromptImageUrls(input.sourceImages, input.referenceImages),
  };
}

export interface ImageFlowModelConfigLike {
  id: string;
  model: string;
  provider?: string | null;
}

export function buildPromptOptimizeEstimateInput(
  taskType: string,
  config: ImageFlowModelConfigLike,
  tokens: { inputTokens: number; outputTokens: number },
) {
  return {
    taskType,
    modelProvider: config.provider ?? undefined,
    modelName: config.model,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
  };
}

export function buildPromptOptimizeHoldMetadata(input: {
  mode: 'generate' | 'edit';
  prompt: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  config: ImageFlowModelConfigLike;
  tokens: { inputTokens: number; outputTokens: number };
}) {
  return {
    mode: input.mode,
    promptLength: input.prompt.length,
    modelConfigId: input.config.id,
    modelName: input.config.model,
    inputTokens: input.tokens.inputTokens,
    estimatedOutputTokens: input.tokens.outputTokens,
    referenceImages:
      (input.sourceImages?.length ?? 0) +
      (input.referenceImages?.length ?? 0),
  };
}

export function buildPromptOptimizeHoldRemark(
  provider: string | null | undefined,
  model: string,
): string {
  return `图片工作台 Prompt AI 优化 · ${formatBillingModel(provider, model)}`;
}

export function buildImageGenerationEstimateInput(
  request: ResolvedImageRequest,
  quantity: number,
) {
  return {
    taskType: resolveImagePricingTaskType(request),
    modelProvider: request.modelConfig.provider ?? undefined,
    modelName: request.modelConfig.model,
    quality: normalizeImageQuality(request.settings?.quality),
    resolution: request.settings?.size,
    quantity,
    referenceImages:
      (request.sourceImages?.length ?? 0) +
      (request.referenceImages?.length ?? 0),
  };
}

export function buildImageGenerationHoldMetadata(
  input: {
    templateId: string;
    modelConfigId: string;
    conversationId?: string;
  },
  request: ResolvedImageRequest,
) {
  return {
    templateId: input.templateId,
    modelConfigId: input.modelConfigId,
    conversationId: input.conversationId ?? null,
    mode: request.mode,
    prompt: request.prompt,
  };
}

export function buildImageGenerationHoldRemark(taskType: string): string {
  return `image-generation:${taskType}`;
}

export function selectImageReferenceUrl(
  sourceImages?: SourceImageRef[],
  referenceImages?: SourceImageRef[],
): string | undefined {
  return sourceImages?.[0]?.url ?? referenceImages?.[0]?.url;
}

export function buildPersistedImageVariables(
  request: ResolvedImageRequest,
  input: {
    modelConfigId: string;
    chatModelId?: string;
  },
  sourceImages?: SourceImageRef[],
  referenceImages?: SourceImageRef[],
) {
  return {
    ...request.variables,
    __workbench: {
      mode: request.mode,
      sourceImages: sourceImages ?? [],
      referenceImages: referenceImages ?? [],
      settings: request.settings ?? {},
      modelConfigId: input.modelConfigId,
      chatModelId: input.chatModelId ?? null,
    },
  };
}

export function buildGeneratedImageItems(input: {
  images: string[];
  generationId: string;
  prompt: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
}) {
  return input.images.map((url, index) => ({
    url,
    index,
    generationId: input.generationId,
    prompt: input.prompt,
    sourceImages: input.sourceImages,
    referenceImages: input.referenceImages,
  }));
}

export function buildImageResultMessageMetadata(input: {
  generationId: string;
  templateId: string;
  request: ResolvedImageRequest;
  images: ReturnType<typeof buildGeneratedImageItems>;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
}) {
  return {
    messageType: 'image_result',
    mode: input.request.mode,
    generationId: input.generationId,
    templateId: input.templateId,
    model: input.request.modelConfig.model,
    prompt: input.request.prompt,
    sourceImages: input.sourceImages,
    referenceImages: input.referenceImages,
    settings: input.request.settings,
    images: input.images,
  };
}

export function buildImageConversationContent(images: string[]): string {
  return images.map((url) => `![](${url})`).join('\n');
}
