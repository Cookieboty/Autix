import type { Prisma } from '../../../platform/prisma/generated';
import type {
  AppliedImageSettings,
  ResolvedImageRequest,
  SourceImageRef,
} from './image-generation-call-params';
import { toImageFlowJsonValue } from './image-generation-flow.core';

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

// 最终落库的 width/height 只能来自 API 实际应用的 appliedSettings.size（非请求值），
// 且只接受严格的 "WxH" 整数形式；"auto" 或其他任何不可解析的形式（含
// gemini "1024x1024@1K" 这种带分辨率后缀的组合格式）一律存 null——不回读像素，
// 避免与请求值混淆。
const STRICT_SIZE_RE = /^(\d+)x(\d+)$/;

export function parseAppliedImageSize(size: unknown): {
  width: number | null;
  height: number | null;
} {
  // `AppliedImageSettings` 的 key 由 preset 绑定决定（值是 unknown）——不是所有模型都有
  // size，也不保证它是字符串。非字符串一律当「不可解析」，存 null。
  const match = typeof size === 'string' ? STRICT_SIZE_RE.exec(size.trim()) : null;
  if (!match) return { width: null, height: null };
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: null, height: null };
  }
  return { width, height };
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
  appliedSettings?: AppliedImageSettings;
}) {
  const { width, height } = parseAppliedImageSize(input.appliedSettings?.size);
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
    width,
    height,
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
