import {
  type MessageRole,
  type Prisma,
} from '../../../platform/prisma/generated';
import {
  buildImageWorkbenchPrompt,
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
  type ImageModelKind,
} from '@autix/domain/image';
import type {
  AppliedImageSettings,
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

export function resolveImageRequestMode(input: {
  sourceImages?: SourceImageRef[];
}): ResolvedImageRequest['mode'] {
  return input.sourceImages?.length ? 'edit' : 'generate';
}

export function normalizePromptOverride(
  promptOverride: string | undefined,
): string | undefined {
  const prompt = promptOverride?.trim();
  return prompt || undefined;
}

export function buildResolvedImageRequest(input: {
  mode: ResolvedImageRequest['mode'];
  prompt: string;
  modelConfig: ResolvedImageRequest['modelConfig'];
  template: Record<string, unknown>;
  variables: Record<string, string>;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: ImageGenerationSettings;
}): ResolvedImageRequest {
  return {
    mode: input.mode,
    prompt: input.prompt,
    modelConfig: input.modelConfig,
    template: input.template,
    variables: input.variables,
    sourceImages: input.sourceImages,
    referenceImages: input.referenceImages,
    settings: input.settings,
  };
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

export interface ImageFlowImageModelConfigLike {
  model: string;
  provider?: string | null;
  metadata?: unknown;
}

export function buildRefineWorkbenchPromptPlan(input: {
  prompt: string;
  settings?: ImageGenerationSettings;
  imageModel: ImageFlowImageModelConfigLike;
}): {
  kind: ImageModelKind;
  composedPrompt: string;
  additions: string[];
  tuningSettings: ImageGenerationSettings;
} {
  const metadata = asImageFlowRecord(input.imageModel.metadata);
  const kind = detectImageModelKind({
    provider: input.imageModel.provider ?? undefined,
    model: input.imageModel.model,
    metadata,
  });
  const capability = IMAGE_MODEL_CAPABILITIES[kind];
  const composed = buildImageWorkbenchPrompt(
    input.prompt,
    input.settings,
    capability,
    { includePromptTuning: true },
  );

  return {
    kind,
    composedPrompt: composed.prompt,
    additions: composed.additions,
    tuningSettings: {
      ...input.settings,
      imageModelKind: kind,
      imageModelName: input.imageModel.model,
    },
  };
}

export function buildRefineWorkbenchPromptResult(input: {
  originalPrompt: string;
  composedPrompt: string;
  refinedPrompt: string;
  imageModel: Pick<ImageFlowImageModelConfigLike, 'model'>;
  chatModel: { model: string };
  additions: string[];
}) {
  return {
    originalPrompt: input.originalPrompt,
    composedPrompt: input.composedPrompt,
    refinedPrompt: input.refinedPrompt,
    model: input.imageModel.model,
    chatModel: input.chatModel.model,
    additions: input.additions,
  };
}

export interface ImageFlowModelConfigLike {
  id: string;
  model: string;
  provider?: string | null;
  capabilities?: string[] | null;
  createdBy?: string | null;
}

const CHAT_COMPLETION_CAPABILITIES = ['text', 'vision', 'code', 'reasoning'];

export function toImageFlowJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
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

export function buildPromptOptimizeHoldCreateInput(input: {
  taskType: string;
  taskId: string;
  estimate: {
    estimatedCost: number;
    pricingSnapshot?: unknown;
    refundPolicy?: unknown;
  };
  mode: 'generate' | 'edit';
  prompt: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  config: ImageFlowModelConfigLike;
  tokens: { inputTokens: number; outputTokens: number };
}) {
  return {
    taskType: input.taskType,
    taskId: input.taskId,
    amount: input.estimate.estimatedCost,
    pricingSnapshot: toImageFlowJsonValue(input.estimate.pricingSnapshot),
    refundPolicySnapshot: input.estimate.refundPolicy
      ? toImageFlowJsonValue(input.estimate.refundPolicy)
      : undefined,
    metadata: toImageFlowJsonValue(
      buildPromptOptimizeHoldMetadata({
        mode: input.mode,
        prompt: input.prompt,
        sourceImages: input.sourceImages,
        referenceImages: input.referenceImages,
        config: input.config,
        tokens: input.tokens,
      }),
    ),
    remark: buildPromptOptimizeHoldRemark(
      input.config.provider,
      input.config.model,
    ),
  };
}

export function buildPromptOptimizeActualEstimateInput(input: {
  taskType: string;
  config: ImageFlowModelConfigLike;
  hold: { inputTokens: number };
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    contextTokens?: number;
  };
  fallbackOutputTokens: number;
}) {
  return {
    taskType: input.taskType,
    modelProvider: input.config.provider ?? undefined,
    modelName: input.config.model,
    inputTokens: input.usage.inputTokens ?? input.hold.inputTokens,
    outputTokens: input.usage.outputTokens ?? input.fallbackOutputTokens,
    contextTokens: input.usage.contextTokens,
  };
}

export function resolvePromptOptimizeConfirmAmount(input: {
  actualEstimatedCost: number;
  heldEstimatedCost: number;
}): number {
  return Math.min(input.actualEstimatedCost, input.heldEstimatedCost);
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

export function buildImageGenerationHoldCreateInput(input: {
  taskId: string;
  estimate: {
    taskType: string;
    estimatedCost: number;
    pricingSnapshot?: unknown;
    refundPolicy?: unknown;
  };
  requestInput: {
    templateId: string;
    modelConfigId: string;
    conversationId?: string;
  };
  request: ResolvedImageRequest;
}) {
  return {
    taskType: input.estimate.taskType,
    taskId: input.taskId,
    amount: input.estimate.estimatedCost,
    pricingSnapshot: toImageFlowJsonValue(input.estimate.pricingSnapshot),
    refundPolicySnapshot: toImageFlowJsonValue(input.estimate.refundPolicy),
    metadata: toImageFlowJsonValue(
      buildImageGenerationHoldMetadata(input.requestInput, input.request),
    ),
    remark: buildImageGenerationHoldRemark(input.estimate.taskType),
  };
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

export function buildCompletedImageGenerationRepositoryInput(input: {
  requestInput: {
    templateId: string;
    userId: string;
    modelConfigId: string;
    chatModelId?: string;
    conversationId?: string;
  };
  request: ResolvedImageRequest;
  images: string[];
  durationMs: number;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
}) {
  return {
    templateId: input.requestInput.templateId,
    userId: input.requestInput.userId,
    modelUsed: input.request.modelConfig.model,
    resolvedPrompt: input.request.prompt,
    variables: toImageFlowJsonValue(
      buildPersistedImageVariables(
        input.request,
        input.requestInput,
        input.sourceImages,
        input.referenceImages,
      ),
    ),
    referenceImage: selectImageReferenceUrl(
      input.sourceImages,
      input.referenceImages,
    ),
    generatedImages: input.images,
    durationMs: input.durationMs,
    conversationId: input.requestInput.conversationId,
    conversationContent: buildImageConversationContent(input.images),
    buildImageItems: (generationId: string) =>
      buildGeneratedImageItems({
        images: input.images,
        generationId,
        prompt: input.request.prompt,
        sourceImages: input.sourceImages,
        referenceImages: input.referenceImages,
      }),
    buildMessageMetadata: (
      generationId: string,
      items: ReturnType<typeof buildGeneratedImageItems>,
    ) =>
      buildImageResultMessageMetadata({
        generationId,
        templateId: input.requestInput.templateId,
        request: input.request,
        images: items,
        sourceImages: input.sourceImages,
        referenceImages: input.referenceImages,
      }) as Prisma.InputJsonValue,
  };
}

export function supportsImagePromptChatModel(
  config: Pick<ImageFlowModelConfigLike, 'capabilities'>,
): boolean {
  const caps = config.capabilities ?? [];
  return (
    caps.length === 0 ||
    CHAT_COMPLETION_CAPABILITIES.some((capability) => caps.includes(capability))
  );
}

export function supportsImagePromptVision(
  config: Pick<ImageFlowModelConfigLike, 'capabilities'>,
): boolean {
  const caps = config.capabilities ?? [];
  return caps.length === 0 || caps.includes('vision');
}

export function buildWorkbenchHumanMessageContent(
  text: string,
  imageUrls: string[],
) {
  if (imageUrls.length === 0) return text;
  return [
    { type: 'text', text },
    ...imageUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url },
    })),
  ];
}

export function normalizeImageGenerationCount(count: number): number {
  return Math.max(1, Math.min(count, 4));
}

export function isUserOwnedImageModel(
  userId: string,
  request: Pick<ResolvedImageRequest, 'modelConfig'>,
): boolean {
  return request.modelConfig.createdBy === userId;
}

export function resolvePersistedGenerationId(
  generation: unknown,
  fallbackId: string,
): string {
  return typeof (generation as { id?: unknown })?.id === 'string'
    ? (generation as { id: string }).id
    : fallbackId;
}

export function buildImageGenerationSuccessResult<
  TPersisted extends { generation: unknown; images: unknown[] },
>(input: {
  persisted: TPersisted;
  appliedSettings: AppliedImageSettings;
  request: Pick<ResolvedImageRequest, 'prompt' | 'modelConfig'>;
}): TPersisted & {
  appliedSettings: AppliedImageSettings;
  prompt: string;
  model: string;
} {
  return {
    ...input.persisted,
    appliedSettings: input.appliedSettings,
    prompt: input.request.prompt,
    model: input.request.modelConfig.model,
  };
}

export function getUploadFailureLogDetails(input: {
  image: unknown;
  index: number;
  reason: unknown;
}): { index: number; sizeHint: number; preview: string; reason: string } {
  const preview =
    typeof input.image === 'string' ? input.image.slice(0, 32) : '';
  const sizeHint = typeof input.image === 'string' ? input.image.length : 0;
  return {
    index: input.index,
    sizeHint,
    preview,
    reason: String(input.reason),
  };
}
