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
