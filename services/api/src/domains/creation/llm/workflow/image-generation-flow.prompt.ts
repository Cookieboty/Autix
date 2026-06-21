import type { MessageRole } from '../../../platform/prisma/generated';
import {
  buildImageWorkbenchPrompt,
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
  type ImageModelKind,
} from '@autix/domain/image';
import type {
  ImageGenerationSettings,
  ResolvedImageRequest,
  SourceImageRef,
} from './image-generation-call-params';
import {
  asImageFlowRecord,
  isImageDataUrl,
  type ImageFlowModelConfigLike,
} from './image-generation-flow.core';

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

const CHAT_COMPLETION_CAPABILITIES = ['text', 'vision', 'code', 'reasoning'];

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
