import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  MessageRole,
  ModelType,
  type Prisma,
} from '../../prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelConfigService } from '../../model-config/model-config.service';
import { ImageTemplatesService } from '../../image-templates/image-templates.service';
import { PointsService } from '../../points/points.service';
import { InviteService } from '../../invite/invite.service';
import { CampaignRewardService } from '../../campaign/campaign-reward.service';
import { createChatModelFromDbConfig } from '../model.factory';
import { estimateTextTokens, extractTokenUsage } from '../billing/token-estimation';
import { resolveImageAdapter, type ImageCallContext } from '@autix/ai-adapters/image';
import { UpstreamParamsInvalidError } from '@autix/ai-adapters/core';
import {
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
  type ImageModelKind,
} from '@autix/shared-lib/image-capabilities';
import { coerceImageParams } from '@autix/shared-lib/image-coerce';
import { buildImageWorkbenchPrompt } from '@autix/shared-lib/image-prompt';

interface SafeDefaults {
  size: string;
  quality?: string;
  count: number;
}

// Per-kind fallback used by the one-shot retry path. Each entry is guaranteed
// to be inside the corresponding capability whitelist, so the second attempt
// can never trip the same upstream 4xx for params.
const SAFE_DEFAULTS_BY_KIND: Record<ImageModelKind, SafeDefaults> = {
  'gpt-image': { size: 'auto', quality: 'auto', count: 1 },
  'gemini-nano': { size: '1024x1024', count: 1 },
  compatible: { size: '1024x1024', quality: 'standard', count: 1 },
};

const PROMPT_OPTIMIZE_TASK_TYPE = 'prompt_optimize_generation';

export interface AppliedImageSettings {
  size?: string;
  quality?: string;
  count: number;
  coerced: boolean;
  notes: string[];
  kind: ImageModelKind;
}

export interface CallImageApiResult {
  images: string[];
  appliedSettings: AppliedImageSettings;
}

export interface PersistedImageResult {
  generation: unknown;
  images: Array<{
    url: string;
    index: number;
    generationId: string;
    prompt: string;
    sourceImages?: SourceImageRef[];
    referenceImages?: SourceImageRef[];
  }>;
}

export interface GenerateAndPersistImageResult extends PersistedImageResult {
  appliedSettings: AppliedImageSettings;
  prompt: string;
  model: string;
}

// Heuristic: any upstream HTTP status in [400, 500) is treated as a retryable
// "parameter" failure. Adapters use `assertResponseOk` which embeds the status
// code as ` <status>: ` inside the Error message; we match that. Typed
// `UpstreamParamsInvalidError` is handled separately by direct instanceof
// check at the call site.
const UPSTREAM_4XX_RE = /\s(4\d{2}):\s/;

function isUpstream4xx(err: unknown): boolean {
  if (err instanceof UpstreamParamsInvalidError) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return UPSTREAM_4XX_RE.test(msg);
}

export interface SourceImageRef {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

export interface ImageGenerationSettings {
  size?: string;
  quality?: string;
  promptTuning?: string;
  stylePreset?: string;
  negativePrompt?: string;
  skipPromptTuning?: boolean;
  guidanceScale?: number;
  steps?: number;
  seed?: string;
  [key: string]: unknown;
}

export interface ResolveImageRequestInput {
  userId: string;
  conversationId?: string;
  templateId: string;
  modelConfigId: string;
  chatModelId?: string;
  variables?: Record<string, string>;
  promptOverride?: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  editInstruction?: string;
  settings?: ImageGenerationSettings;
}

export interface ResolvedImageRequest {
  mode: 'generate' | 'edit';
  prompt: string;
  modelConfig: {
    id: string;
    model: string;
    provider?: string | null;
    baseUrl?: string | null;
    apiKey?: string | null;
    metadata?: Prisma.JsonValue | null;
    createdBy?: string | null;
  };
  template: Record<string, unknown>;
  variables: Record<string, string>;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: ImageGenerationSettings;
}

export interface RefineWorkbenchPromptInput {
  mode: 'generate' | 'edit';
  prompt: string;
  imageModelConfigId: string;
  chatModelId?: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  settings?: ImageGenerationSettings;
}

export interface RefineWorkbenchPromptResult {
  originalPrompt: string;
  composedPrompt: string;
  refinedPrompt: string;
  model: string;
  chatModel: string;
  additions: string[];
}

interface ChatModelConfigLike {
  id: string;
  model: string;
  provider?: string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
  metadata?: unknown;
  type: string;
  capabilities?: string[] | null;
}

interface SummaryInput {
  mode: 'generate' | 'edit';
  template: { prompt: string; title?: string | null };
  variables: Record<string, string>;
  conversationSummary: string;
  sourceImages?: SourceImageRef[];
  referenceImages?: SourceImageRef[];
  editInstruction?: string;
  lastGeneratedPrompt?: string;
  userId: string;
  chatModelId?: string;
}

@Injectable()
export class ImageGenerationFlowService {
  private readonly logger = new Logger(ImageGenerationFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelConfigService: ModelConfigService,
    private readonly imageTemplatesService: ImageTemplatesService,
    private readonly pointsService: PointsService,
    private readonly inviteService: InviteService,
    private readonly campaignRewardService: CampaignRewardService,
  ) { }

  buildConversationSummary(
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
      const metadata = this.asRecord(message.metadata);
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
          const imageRecord = this.asRecord(image);
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

  async resolveImageRequest(
    input: ResolveImageRequestInput,
  ): Promise<ResolvedImageRequest> {
    const template = (await this.imageTemplatesService.findById(
      input.templateId,
    )) as { prompt: string; title?: string | null };
    const variables = input.variables ?? {};
    const mode = input.sourceImages?.length ? 'edit' : 'generate';
    const modelConfig = await this.modelConfigService.getConfigForOrchestrator(
      input.modelConfigId,
    );

    let prompt = input.promptOverride?.trim();
    if (!prompt) {
      if (!input.conversationId) {
        throw new BadRequestException('Missing conversationId for prompt summarization');
      }
      const messages = await this.prisma.messages.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: 'asc' },
      });
      const conversationSummary = this.buildConversationSummary(messages);
      prompt = await this.summarizePrompt({
        mode,
        template,
        variables,
        conversationSummary,
        sourceImages: input.sourceImages,
        referenceImages: input.referenceImages,
        editInstruction: input.editInstruction,
        lastGeneratedPrompt: this.findLastGeneratedPrompt(messages),
        userId: input.userId,
        chatModelId: input.chatModelId,
      });
    } else if (input.chatModelId && this.shouldTuneWorkbenchPrompt(input.settings)) {
      prompt = await this.tuneWorkbenchPrompt({
        mode,
        template,
        prompt,
        sourceImages: input.sourceImages,
        referenceImages: input.referenceImages,
        settings: input.settings,
        userId: input.userId,
        chatModelId: input.chatModelId,
      });
    }

    return {
      mode,
      prompt,
      modelConfig,
      template: template as Record<string, unknown>,
      variables,
      sourceImages: input.sourceImages,
      referenceImages: input.referenceImages,
      settings: input.settings,
    };
  }

  async refineWorkbenchPrompt(
    userId: string,
    input: RefineWorkbenchPromptInput,
  ): Promise<RefineWorkbenchPromptResult> {
    const imageModel = await this.modelConfigService.getConfigForOrchestrator(
      input.imageModelConfigId,
    );
    const metadata = this.asRecord(imageModel.metadata);
    const kind = detectImageModelKind({
      provider: imageModel.provider ?? undefined,
      model: imageModel.model,
      metadata,
    });
    const capability = IMAGE_MODEL_CAPABILITIES[kind];
    const composed = buildImageWorkbenchPrompt(input.prompt, input.settings, capability, {
      includePromptTuning: true,
    });
    const chatConfig = input.chatModelId
      ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelId)
      : await this.modelConfigService.findDefaultByType(ModelType.general);

    if (!chatConfig) {
      throw new BadRequestException({
        errorCode: 'ERR_DEFAULT_GENERAL_MODEL_MISSING',
        message: 'No default general model configured for prompt refinement',
      });
    }

    const refinedPrompt = await this.tuneWorkbenchPrompt({
      mode: input.mode,
      template: {
        title: '专业图片工作台',
        prompt: '{{prompt}}',
      },
      prompt: composed.prompt,
      sourceImages: input.sourceImages,
      referenceImages: input.referenceImages,
      settings: {
        ...input.settings,
        imageModelKind: kind,
        imageModelName: imageModel.model,
      },
      userId,
      chatModelConfig: chatConfig,
    });

    return {
      originalPrompt: input.prompt,
      composedPrompt: composed.prompt,
      refinedPrompt,
      model: imageModel.model,
      chatModel: chatConfig.model,
      additions: composed.additions,
    };
  }

  async summarizePrompt(input: SummaryInput): Promise<string> {
    const config = input.chatModelId
      ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelId)
      : await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!config) {
      throw new BadRequestException({
        errorCode: 'ERR_DEFAULT_GENERAL_MODEL_MISSING',
        message: 'No default general model configured for prompt summarization',
      });
    }

    const caps: string[] = config.capabilities ?? [];
    const CHAT_CAPS = ['text', 'vision', 'code', 'reasoning'];
    const supportsChat = caps.length === 0 || CHAT_CAPS.some((c) => caps.includes(c));
    if (!supportsChat) {
      throw new BadRequestException({
        errorCode: 'ERR_CHAT_MODEL_INVALID',
        message: `Model ${config.id} does not support chat completion`,
      });
    }

    const model = createChatModelFromDbConfig(config);
    const system = [
      'You are an expert image prompt compressor.',
      'Return only the final prompt text. No explanation.',
      'For generation: write a concise English image prompt based on the template and user requirements.',
      'For editing: write a concise English edit instruction with what to preserve and what to change.',
      'Keep under 500 words.',
    ].join('\n');
    const sourceImages = input.sourceImages
      ?.map((img, index) => this.formatPromptImageRef(img, index, 'original prompt'))
      .join('\n');
    const referenceImages = input.referenceImages
      ?.map((img, index) => this.formatPromptImageRef(img, index, 'reference note'))
      .join('\n');
    const imageUrls = this.collectPromptImageUrls(input.sourceImages, input.referenceImages);
    const userText = [
      `Mode: ${input.mode}`,
      `Template title: ${input.template.title ?? ''}`,
      `Template prompt: ${input.template.prompt}`,
      `Variables: ${JSON.stringify(input.variables)}`,
      input.lastGeneratedPrompt
        ? `Last generated prompt: ${input.lastGeneratedPrompt}`
        : '',
      sourceImages ? `Source images:\n${sourceImages}` : '',
      referenceImages ? `Reference images (visual guidance only, not edit targets):\n${referenceImages}` : '',
      input.editInstruction
        ? `Latest edit instruction: ${input.editInstruction}`
        : '',
      `Conversation summary:\n${input.conversationSummary}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await model.invoke([
      new SystemMessage(system),
      this.buildWorkbenchHumanMessage(userText, config, imageUrls),
    ]);

    const content =
      typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);
    return content.trim();
  }

  private shouldTuneWorkbenchPrompt(settings?: ImageGenerationSettings): boolean {
    if (!settings) return false;
    if (settings.skipPromptTuning === true) return false;
    const promptTuning = String(settings.promptTuning ?? '');
    return Boolean(promptTuning && promptTuning !== '忠实原文');
  }

  private formatPromptImageRef(
    img: SourceImageRef,
    index: number,
    promptLabel: string,
  ): string {
    const url = this.isImageDataUrl(img.url)
      ? `[uploaded image data: ${img.url.slice(0, 32)}...]`
      : img.url;
    return `${index + 1}. ${url}${img.prompt ? ` | ${promptLabel}: ${img.prompt}` : ''}`;
  }

  private collectPromptImageUrls(
    sourceImages?: SourceImageRef[],
    referenceImages?: SourceImageRef[],
  ): string[] {
    return [
      ...(sourceImages ?? []),
      ...(referenceImages ?? []),
    ].map((img) => img.url);
  }

  private buildWorkbenchHumanMessage(
    text: string,
    config: ChatModelConfigLike,
    imageUrls: string[],
  ): HumanMessage {
    if (imageUrls.length === 0) return new HumanMessage(text);

    const caps: string[] = config.capabilities ?? [];
    const supportsVision = caps.length === 0 || caps.includes('vision');
    if (!supportsVision) {
      throw new BadRequestException({
        errorCode: 'ERR_CHAT_MODEL_VISION_REQUIRED',
        message: '所选 Prompt 微调模型不支持图片理解，请选择支持图片理解的模型或移除参考图。',
      });
    }

    return new HumanMessage({
      content: [
        { type: 'text', text },
        ...imageUrls.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ],
    });
  }

  private async tuneWorkbenchPrompt(input: {
    mode: 'generate' | 'edit';
    template: { prompt: string; title?: string | null };
    prompt: string;
    sourceImages?: SourceImageRef[];
    referenceImages?: SourceImageRef[];
    settings?: ImageGenerationSettings;
    userId: string;
    chatModelId?: string;
    chatModelConfig?: ChatModelConfigLike;
  }): Promise<string> {
    const config = input.chatModelConfig ??
      (input.chatModelId
        ? await this.modelConfigService.getConfigForOrchestrator(input.chatModelId)
        : await this.modelConfigService.findDefaultByType(ModelType.general));

    if (!config) {
      throw new BadRequestException({
        errorCode: 'ERR_DEFAULT_GENERAL_MODEL_MISSING',
        message: 'No default general model configured for prompt refinement',
      });
    }

    const caps: string[] = config.capabilities ?? [];
    const chatCaps = ['text', 'vision', 'code', 'reasoning'];
    const supportsChat = caps.length === 0 || chatCaps.some((c) => caps.includes(c));
    if (!supportsChat) {
      throw new BadRequestException({
        errorCode: 'ERR_CHAT_MODEL_INVALID',
        message: `Model ${config.id} does not support chat completion`,
      });
    }

    const model = createChatModelFromDbConfig(config);
    const sourceImages = input.sourceImages
      ?.map((img, index) => this.formatPromptImageRef(img, index, 'source prompt'))
      .join('\n');
    const referenceImages = input.referenceImages
      ?.map((img, index) => this.formatPromptImageRef(img, index, 'reference note'))
      .join('\n');
    const imageUrls = this.collectPromptImageUrls(input.sourceImages, input.referenceImages);
    const userText = [
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
      .join('\n\n');

    const system = [
      'You are an expert image prompt editor for a professional image workstation.',
      'Return only the final prompt text. No markdown, no explanation.',
      'Preserve the user intent and any explicit product, brand, character, text, composition, or constraint.',
      'If the mode is edit, be precise about what to preserve and what to change.',
      'Keep the prompt concise but production-ready.',
    ].join('\n');

    const inputTokens = estimateTextTokens(`${system}\n\n${userText}`);
    const estimatedOutputTokens = Math.max(128, estimateTextTokens(input.prompt));
    const hold = await this.createPromptOptimizeHold(input, config, {
      inputTokens,
      outputTokens: estimatedOutputTokens,
    });
    try {
      const result = await model.invoke([
        new SystemMessage(system),
        this.buildWorkbenchHumanMessage(userText, config, imageUrls),
      ]);

      const content =
        typeof result.content === 'string'
          ? result.content
          : JSON.stringify(result.content);
      await this.confirmPromptOptimizeHold(hold, config, result, content);
      return content.trim() || input.prompt;
    } catch (err) {
      await this.safeRefundPromptOptimizeHold(hold.holdId, 'Prompt 优化失败');
      throw err;
    }
  }

  private async createPromptOptimizeHold(
    input: {
      userId: string;
      mode: 'generate' | 'edit';
      prompt: string;
      sourceImages?: SourceImageRef[];
      referenceImages?: SourceImageRef[];
    },
    config: ChatModelConfigLike,
    tokens: { inputTokens: number; outputTokens: number },
  ): Promise<{ holdId: string; estimatedCost: number; inputTokens: number; outputTokens: number }> {
    const taskId = `prompt-optimize:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const estimate = await this.pointsService.estimateCost({
      taskType: PROMPT_OPTIMIZE_TASK_TYPE,
      modelProvider: config.provider ?? undefined,
      modelName: config.model,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
    });

    const { hold } = await this.pointsService.createHold(input.userId, {
      taskType: PROMPT_OPTIMIZE_TASK_TYPE,
      taskId,
      amount: estimate.estimatedCost,
      pricingSnapshot: this.toJson(estimate.pricingSnapshot),
      refundPolicySnapshot: estimate.refundPolicy
        ? this.toJson(estimate.refundPolicy)
        : undefined,
      metadata: this.toJson({
        mode: input.mode,
          promptLength: input.prompt.length,
          modelConfigId: config.id,
          modelName: config.model,
          inputTokens: tokens.inputTokens,
          estimatedOutputTokens: tokens.outputTokens,
          referenceImages:
            (input.sourceImages?.length ?? 0) +
            (input.referenceImages?.length ?? 0),
        }),
      remark: `图片工作台 Prompt AI 优化 · ${this.formatBillingModel(config.provider, config.model)}`,
    });
    return {
      holdId: hold.id,
      estimatedCost: estimate.estimatedCost,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
    };
  }

  private async confirmPromptOptimizeHold(
    hold: { holdId: string; estimatedCost: number; inputTokens: number },
    config: ChatModelConfigLike,
    result: unknown,
    content: string,
  ) {
    const usage = extractTokenUsage(result);
    try {
      const actualEstimate = await this.pointsService.estimateCost({
        taskType: PROMPT_OPTIMIZE_TASK_TYPE,
        modelProvider: config.provider ?? undefined,
        modelName: config.model,
        inputTokens: usage.inputTokens ?? hold.inputTokens,
        outputTokens: usage.outputTokens ?? estimateTextTokens(content),
        contextTokens: usage.contextTokens,
      });
      await this.pointsService.confirmHold(
        hold.holdId,
        Math.min(actualEstimate.estimatedCost, hold.estimatedCost),
      );
    } catch {
      await this.pointsService.confirmHold(hold.holdId);
    }
  }

  private formatBillingModel(provider: string | null | undefined, model: string): string {
    return [provider, model].filter(Boolean).join('/') || model;
  }

  private async safeRefundPromptOptimizeHold(holdId: string, reason: string) {
    try {
      await this.pointsService.refundHold(holdId, reason);
    } catch (err) {
      this.logger.error(
        `prompt optimize point hold refund failed: hold=${holdId} reason=${String(
          err instanceof Error ? err.message : err,
        )}`,
      );
    }
  }

  async callImageApi(
    request: ResolvedImageRequest,
    count: number,
  ): Promise<CallImageApiResult> {
    const metadata = this.asRecord(request.modelConfig.metadata);
    const apiKey =
      request.modelConfig.apiKey ??
      (typeof metadata?.apiKey === 'string' ? metadata.apiKey : '');
    const baseUrl =
      request.modelConfig.baseUrl ??
      (typeof metadata?.baseUrl === 'string' ? metadata.baseUrl : '');

    if (!baseUrl || !apiKey) {
      throw new BadRequestException('图片模型缺少 baseUrl 或 apiKey 配置');
    }

    const kind = detectImageModelKind({
      provider: request.modelConfig.provider ?? undefined,
      model: request.modelConfig.model,
    });

    // First normalization pass: client-submitted settings → kind-legal values.
    const coerced = coerceImageParams({
      kind,
      size: request.settings?.size,
      quality: request.settings?.quality,
      count,
      negativePrompt:
        typeof request.settings?.negativePrompt === 'string'
          ? request.settings.negativePrompt
          : undefined,
    });

    if (coerced.notes.length > 0) {
      this.logger.warn(
        `coerceImageParams adjusted ${request.modelConfig.model} (kind=${kind}): ${coerced.notes.join('; ')}`,
      );
    }

    const buildCtx = (params: { size?: string; quality?: string; count: number }): ImageCallContext => ({
      baseUrl,
      apiKey,
      model: request.modelConfig.model,
      prompt: request.prompt,
      count: params.count,
      size: params.size,
      quality: params.quality,
      sourceImages: request.sourceImages,
      referenceImages: request.referenceImages,
      metadata: metadata ?? undefined,
    });

    const adapter = resolveImageAdapter(request.modelConfig.provider, metadata);
    const dispatch = (ctx: ImageCallContext): Promise<string[]> =>
      request.mode === 'edit' ? adapter.edit(ctx) : adapter.generate(ctx);

    const primaryCtx = buildCtx({
      size: coerced.size,
      quality: coerced.quality,
      count: coerced.count,
    });

    try {
      const images = await dispatch(primaryCtx);
      return {
        images,
        appliedSettings: {
          size: coerced.size,
          quality: coerced.quality,
          count: coerced.count,
          coerced: coerced.notes.length > 0,
          notes: coerced.notes,
          kind,
        },
      };
    } catch (err) {
      if (!isUpstream4xx(err)) throw err;

      const safe = SAFE_DEFAULTS_BY_KIND[kind];
      this.logger.warn(
        `upstream 4xx for ${request.modelConfig.model} (kind=${kind}); retrying with safe defaults size=${safe.size} quality=${safe.quality ?? '-'} count=${safe.count}. reason=${err instanceof Error ? err.message : String(err)
        }`,
      );

      const safeCtx = buildCtx({
        size: safe.size,
        quality: safe.quality,
        count: safe.count,
      });

      try {
        const images = await dispatch(safeCtx);
        return {
          images,
          appliedSettings: {
            size: safe.size,
            quality: safe.quality,
            count: safe.count,
            coerced: true,
            notes: [
              ...coerced.notes,
              `upstream 4xx fallback → safe defaults for kind=${kind}`,
            ],
            kind,
          },
        };
      } catch (retryErr) {
        if (!isUpstream4xx(retryErr)) throw retryErr;
        const cap = IMAGE_MODEL_CAPABILITIES[kind];
        throw new BadRequestException({
          errorCode: 'ERR_IMAGE_PARAMS_NOT_SUPPORTED',
          message: `当前模型不支持所选参数，请尝试其他尺寸或质量。（${cap.displayName}）`,
          details: {
            kind,
            model: request.modelConfig.model,
            firstError: err instanceof Error ? err.message : String(err),
            retryError: retryErr instanceof Error ? retryErr.message : String(retryErr),
          },
        });
      }
    }
  }

  private static readonly IMAGE_DATA_URL_RE = /^data:image\/(\w+);base64,/i;

  private isImageDataUrl(value: string | undefined | null): value is string {
    return typeof value === 'string' && ImageGenerationFlowService.IMAGE_DATA_URL_RE.test(value);
  }

  async uploadGeneratedImage(image: string): Promise<string> {
    if (!this.isImageDataUrl(image)) return image;
    return this.imageTemplatesService.uploadBase64Image(
      image,
      'amux-studio/image-generations',
    );
  }

  async uploadGeneratedImages(images: string[]): Promise<string[]> {
    if (!Array.isArray(images) || images.length === 0) return [];
    const results = await Promise.allSettled(
      images.map((image) => this.uploadGeneratedImage(image)),
    );
    return results.map((res, idx) => {
      if (res.status === 'fulfilled') return res.value;
      const original = images[idx];
      const preview = typeof original === 'string' ? original.slice(0, 32) : '';
      const sizeHint = typeof original === 'string' ? original.length : 0;
      this.logger.error(
        `uploadGeneratedImage failed at index=${idx} size=${sizeHint} head="${preview}" reason=${String(
          (res as PromiseRejectedResult).reason,
        )}`,
      );
      return original;
    });
  }

  async generateAndPersistImage(
    input: ResolveImageRequestInput,
    request: ResolvedImageRequest,
    count: number,
    options?: { persistedRequest?: ResolvedImageRequest },
  ): Promise<GenerateAndPersistImageResult> {
    const startedAt = Date.now();
    const normalizedCount = Math.max(1, Math.min(count, 4));
    const persistedRequest = options?.persistedRequest ?? request;
    const billingTaskId = `image:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    let holdId: string | null = null;

    if (!this.isOwnImageModel(input.userId, request)) {
      const estimate = await this.pointsService.estimateCost({
        taskType: this.resolveImagePricingTaskType(request),
        modelProvider: request.modelConfig.provider ?? undefined,
        modelName: request.modelConfig.model,
        quality: this.normalizeImageQuality(request.settings?.quality),
        resolution: request.settings?.size,
        quantity: normalizedCount,
        referenceImages:
          (request.sourceImages?.length ?? 0) +
          (request.referenceImages?.length ?? 0),
      });

      const { hold } = await this.pointsService.createHold(input.userId, {
        taskType: estimate.taskType,
        taskId: billingTaskId,
        amount: estimate.estimatedCost,
        pricingSnapshot: this.toJson(estimate.pricingSnapshot),
        refundPolicySnapshot: this.toJson(estimate.refundPolicy),
        metadata: this.toJson({
          templateId: input.templateId,
          modelConfigId: input.modelConfigId,
          conversationId: input.conversationId ?? null,
          mode: request.mode,
          prompt: request.prompt,
        }),
        remark: `image-generation:${estimate.taskType}`,
      });
      holdId = hold.id;
    }

    try {
      const { images, appliedSettings } = await this.callImageApi(
        request,
        normalizedCount,
      );
      const uploadedImages = await this.uploadGeneratedImages(images);
      const persisted = await this.persistImageResult(
        input,
        persistedRequest,
        uploadedImages,
        Date.now() - startedAt,
      );

      if (holdId) {
        await this.pointsService.confirmHold(holdId);
      }

      const generationId =
        typeof (persisted.generation as { id?: unknown })?.id === 'string'
          ? (persisted.generation as { id: string }).id
          : billingTaskId;

      this.campaignRewardService
        .recordSuccessGeneration(input.userId, 'image', generationId)
        .catch((err) =>
          this.logger.warn(
            `recordSuccessGeneration (image) failed: user=${input.userId} reason=${(err as Error).message}`,
          ),
        );

      // P0-3: 图片生成成功后触发邀请奖励结算（幂等；无邀请记录或已结算时无副作用）
      this.inviteService
        .settleInvitationOnFirstGeneration(input.userId)
        .catch((err) =>
          this.logger.warn(
            `settleInvitationOnFirstGeneration (image) failed: user=${input.userId} reason=${(err as Error).message}`,
          ),
        );

      return {
        ...persisted,
        appliedSettings,
        prompt: request.prompt,
        model: request.modelConfig.model,
      };
    } catch (err) {
      if (holdId) {
        await this.safeRefundImageHold(holdId, '图片生成失败');
      }
      throw err;
    }
  }

  private async uploadRefIfDataUrl(
    ref: SourceImageRef | undefined,
  ): Promise<SourceImageRef | undefined> {
    if (!ref || !this.isImageDataUrl(ref.url)) return ref;
    try {
      const url = await this.imageTemplatesService.uploadBase64Image(
        ref.url,
        'amux-studio/image-generations',
      );
      return { ...ref, url };
    } catch (err) {
      this.logger.error(
        `uploadRefIfDataUrl failed: ${String(err instanceof Error ? err.message : err)}`,
      );
      return ref;
    }
  }

  private async normalizeRefImages(
    refs: SourceImageRef[] | undefined,
  ): Promise<SourceImageRef[] | undefined> {
    if (!refs || refs.length === 0) return refs;
    return Promise.all(refs.map((ref) => this.uploadRefIfDataUrl(ref))).then(
      (list) => list.filter((v): v is SourceImageRef => !!v),
    );
  }

  async persistImageResult(
    input: ResolveImageRequestInput,
    request: ResolvedImageRequest,
    images: string[],
    durationMs: number,
  ): Promise<PersistedImageResult> {
    const normalizedSourceImages = await this.normalizeRefImages(request.sourceImages);
    const normalizedReferenceImages = await this.normalizeRefImages(request.referenceImages);
    const referenceImageUrl =
      normalizedSourceImages?.[0]?.url ?? normalizedReferenceImages?.[0]?.url;
    const persistedVariables = this.toJson({
      ...request.variables,
      __workbench: {
        mode: request.mode,
        sourceImages: normalizedSourceImages ?? [],
        referenceImages: normalizedReferenceImages ?? [],
        settings: request.settings ?? {},
        modelConfigId: input.modelConfigId,
        chatModelId: input.chatModelId ?? null,
      },
    });

    const imageItemsSeed = (generationId: string) =>
      images.map((url, index) => ({
        url,
        index,
        generationId,
        prompt: request.prompt,
        sourceImages: normalizedSourceImages,
        referenceImages: normalizedReferenceImages,
      }));

    const { generation, imageItems } = await this.prisma.$transaction(async (tx) => {
      const generation = await tx.image_generations.create({
        data: {
          templateId: input.templateId,
          userId: input.userId,
          modelUsed: request.modelConfig.model,
          resolvedPrompt: request.prompt,
          variables: persistedVariables,
          referenceImage: referenceImageUrl,
          generatedImages: images,
          status: 'completed',
          durationMs,
        },
      });

      await tx.image_templates.update({
        where: { id: input.templateId },
        data: { useCount: { increment: 1 } },
      });

      const imageItems = imageItemsSeed(generation.id);

      if (input.conversationId) {
        await tx.messages.create({
          data: {
            conversationId: input.conversationId,
            role: MessageRole.ASSISTANT,
            content: images.map((url) => `![](${url})`).join('\n'),
            metadata: {
              messageType: 'image_result',
              mode: request.mode,
              generationId: generation.id,
              templateId: input.templateId,
              model: request.modelConfig.model,
              prompt: request.prompt,
              sourceImages: normalizedSourceImages,
              referenceImages: normalizedReferenceImages,
              settings: request.settings,
              images: imageItems,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return { generation, imageItems };
    });

    return { generation, images: imageItems };
  }

  private isOwnImageModel(userId: string, request: ResolvedImageRequest): boolean {
    return request.modelConfig.createdBy === userId;
  }

  private normalizeImageQuality(value: unknown): 'low' | 'medium' | 'high' {
    const quality = String(value ?? 'medium').toLowerCase();
    if (quality.includes('low')) return 'low';
    if (quality.includes('high') || quality.includes('hd')) return 'high';
    return 'medium';
  }

  private resolveImagePricingTaskType(request: ResolvedImageRequest): string {
    const quality = this.normalizeImageQuality(request.settings?.quality);
    if (quality === 'low') return 'gpt_image_2_low';
    if (quality === 'high') return 'gpt_image_2_high';
    return 'gpt_image_2_medium';
  }

  private async safeRefundImageHold(holdId: string, reason: string) {
    try {
      await this.pointsService.refundHold(holdId, reason);
    } catch (err) {
      this.logger.error(
        `image generation point hold refund failed: hold=${holdId} reason=${String(
          err instanceof Error ? err.message : err,
        )}`,
      );
    }
  }

  private findLastGeneratedPrompt(messages: Array<{ metadata?: unknown }>): string | undefined {
    for (const message of [...messages].reverse()) {
      const metadata = this.asRecord(message.metadata);
      if (
        metadata?.messageType === 'image_result' &&
        typeof metadata.prompt === 'string'
      ) {
        return metadata.prompt;
      }
    }
    return undefined;
  }

  private asRecord(value: unknown): Record<string, any> | undefined {
    return value && typeof value === 'object'
      ? (value as Record<string, any>)
      : undefined;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
