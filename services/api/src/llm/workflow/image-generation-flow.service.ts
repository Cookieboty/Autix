import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  MessageRole,
  ModelType,
  PointsSource,
  type Prisma,
} from '../../prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelConfigService } from '../../model-config/model-config.service';
import { ImageTemplatesService } from '../../image-templates/image-templates.service';
import { PointsService } from '../../points/points.service';
import { createChatModelFromDbConfig } from '../model.factory';

export interface SourceImageRef {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

export interface ImageGenerationSettings {
  size?: string;
  quality?: string;
}

export interface ResolveImageRequestInput {
  userId: string;
  conversationId: string;
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
      ?.map((img, index) => `${index + 1}. ${img.url}${img.prompt ? ` | original prompt: ${img.prompt}` : ''}`)
      .join('\n');
    const referenceImages = input.referenceImages
      ?.map((img, index) => `${index + 1}. ${img.url}${img.prompt ? ` | reference note: ${img.prompt}` : ''}`)
      .join('\n');

    const result = await model.invoke([
      new SystemMessage(system),
      new HumanMessage(
        [
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
          .join('\n\n'),
      ),
    ]);

    const content =
      typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);
    return content.trim();
  }

  async callImageApi(
    request: ResolvedImageRequest,
    count: number,
  ): Promise<string[]> {
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

    if (request.mode === 'edit') {
      return this.callImageEditApi(baseUrl, apiKey, request, count, metadata);
    }

    return this.callImageGenerationApi(baseUrl, apiKey, request, count, metadata);
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
  ) {
    const isOwnModel = request.modelConfig.createdBy === input.userId;
    let pointsCost = 0;
    if (!isOwnModel) {
      const taskCost = await this.prisma.task_point_costs.findUnique({
        where: { taskType: 'image_generation' },
      });
      pointsCost = taskCost?.cost ?? 0;
    }

    const normalizedSourceImages = await this.normalizeRefImages(request.sourceImages);
    const normalizedReferenceImages = await this.normalizeRefImages(request.referenceImages);
    const referenceImageUrl =
      normalizedSourceImages?.[0]?.url ?? normalizedReferenceImages?.[0]?.url;

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
          variables: request.variables as object,
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

      return { generation, imageItems };
    });

    if (pointsCost > 0) {
      try {
        await this.pointsService.deductPoints(
          input.userId,
          pointsCost,
          PointsSource.TASK,
          undefined,
          `image-generation: ${String(request.template.title ?? input.templateId)}`,
        );
      } catch (err) {
        this.logger.error(
          `deductPoints failed after image-generation persist: user=${input.userId} cost=${pointsCost} reason=${String(
            err instanceof Error ? err.message : err,
          )}`,
        );
      }
    }

    return { generation, images: imageItems };
  }

  private async callImageGenerationApi(
    baseUrl: string,
    apiKey: string,
    request: ResolvedImageRequest,
    count: number,
    metadata?: Record<string, unknown>,
  ): Promise<string[]> {
    const endpoint =
      typeof metadata?.imageGenerationEndpoint === 'string'
        ? metadata.imageGenerationEndpoint
        : '/v1/images/generations';
    const body: Record<string, unknown> = {
      model: request.modelConfig.model,
      prompt: request.prompt,
      n: count,
      response_format: 'b64_json',
    };
    if (request.settings?.size && request.settings.size !== 'auto') {
      body.size = request.settings.size;
    }
    if (request.settings?.quality && request.settings.quality !== 'auto') {
      body.quality = request.settings.quality;
    }

    const response = await fetch(this.buildEndpoint(baseUrl, endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    return this.readImageResponse(response);
  }

  private async callImageEditApi(
    baseUrl: string,
    apiKey: string,
    request: ResolvedImageRequest,
    count: number,
    metadata?: Record<string, unknown>,
  ): Promise<string[]> {
    const endpoint =
      typeof metadata?.imageEditEndpoint === 'string'
        ? metadata.imageEditEndpoint
        : typeof metadata?.imageToImageEndpoint === 'string'
          ? metadata.imageToImageEndpoint
          : '/v1/images/edits';
    const form = new FormData();
    form.set('model', request.modelConfig.model);
    form.set('prompt', request.prompt);
    form.set('n', String(count));
    form.set('response_format', 'b64_json');
    if (request.settings?.size && request.settings.size !== 'auto') {
      form.set('size', request.settings.size);
    }
    if (request.settings?.quality && request.settings.quality !== 'auto') {
      form.set('quality', request.settings.quality);
    }

    for (const [index, source] of (request.sourceImages ?? []).entries()) {
      const imageResponse = await fetch(source.url);
      if (!imageResponse.ok) {
        throw new BadRequestException(`无法读取编辑源图片: ${source.url}`);
      }
      const blob = await imageResponse.blob();
      form.append(index === 0 ? 'image' : `image_${index + 1}`, blob, `source-${index + 1}.png`);
    }

    const response = await fetch(this.buildEndpoint(baseUrl, endpoint), {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    return this.readImageResponse(response);
  }

  private async readImageResponse(response: Response): Promise<string[]> {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new BadRequestException(
        `Image API ${response.status}: ${text.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    return (data.data ?? [])
      .map((item) =>
        item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url,
      )
      .filter((url): url is string => Boolean(url));
  }

  private buildEndpoint(baseUrl: string, endpoint: string): string {
    const normalizedBase = baseUrl.replace(/\/$/, '');
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (normalizedBase.endsWith('/v1') && normalizedEndpoint.startsWith('/v1/')) {
      return `${normalizedBase}${normalizedEndpoint.slice(3)}`;
    }
    return `${normalizedBase}${normalizedEndpoint}`;
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
}
