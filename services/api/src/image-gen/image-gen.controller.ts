import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImageGenerationFlowService } from '../llm/workflow/image-generation-flow.service';
import { PrismaService } from '../prisma/prisma.service';
import { TemplateStatus } from '../prisma/generated';

const IMAGE_WORKBENCH_TEMPLATE_EXTERNAL_ID = 'system:image-workbench';

function extractAmuxHeaders(req: Request) {
  const baseUrl = req.headers['x-amux-base-url'] as string | undefined;
  const apiKey = req.headers['x-amux-api-key'] as string | undefined;
  if (!baseUrl || !apiKey) {
    throw new BadRequestException('Missing X-Amux-Base-Url or X-Amux-Api-Key headers');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

@UseGuards(JwtAuthGuard)
@Controller('image-gen')
export class ImageGenController {
  constructor(
    private readonly imageGenerationFlowService: ImageGenerationFlowService,
    private readonly prisma: PrismaService,
  ) {}

  private async ensureWorkbenchTemplate(userId: string): Promise<string> {
    const existing = await this.prisma.image_templates.findFirst({
      where: {
        authorId: userId,
        externalId: IMAGE_WORKBENCH_TEMPLATE_EXTERNAL_ID,
      },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status !== TemplateStatus.ARCHIVED) {
        await this.prisma.image_templates.update({
          where: { id: existing.id },
          data: { status: TemplateStatus.ARCHIVED },
        });
      }
      return existing.id;
    }

    const template = await this.prisma.image_templates.create({
      data: {
        title: '专业图片工作台',
        description: '工作台直接提示词生成归档模板',
        category: 'workbench',
        prompt: '{{prompt}}',
        variables: [{ key: 'prompt', label: 'Prompt', type: 'textarea', default: '' }],
        tags: ['workbench'],
        authorId: userId,
        status: TemplateStatus.ARCHIVED,
        externalId: IMAGE_WORKBENCH_TEMPLATE_EXTERNAL_ID,
        externalMetadata: {
          internal: true,
          workbench: 'image',
        },
        runtimeReason: '专业图片工作台内部归档模板',
      },
    });
    return template.id;
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private workbenchMeta(variables: unknown) {
    return this.asRecord(this.asRecord(variables)?.__workbench);
  }

  @Get('workbench/history')
  async getWorkbenchHistory(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    const templateId = await this.ensureWorkbenchTemplate(userId);
    const safePage = Math.max(1, page ? Number(page) || 1 : 1);
    const safePageSize = Math.min(60, Math.max(1, pageSize ? Number(pageSize) || 30 : 30));
    const skip = (safePage - 1) * safePageSize;

    const [items, total] = await Promise.all([
      this.prisma.image_generations.findMany({
        where: { userId, templateId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safePageSize,
        select: {
          id: true,
          resolvedPrompt: true,
          generatedImages: true,
          referenceImage: true,
          variables: true,
          modelUsed: true,
          status: true,
          durationMs: true,
          createdAt: true,
        },
      }),
      this.prisma.image_generations.count({ where: { userId, templateId } }),
    ]);

    return {
      items: items.map((item) => {
        const meta = this.workbenchMeta(item.variables);
        const sourceImages = Array.isArray(meta?.sourceImages)
          ? meta.sourceImages
          : [];
        const referenceImages = Array.isArray(meta?.referenceImages)
          ? meta.referenceImages
          : [];

        return {
          ...item,
          mode: meta?.mode,
          settings: this.asRecord(meta?.settings) ?? {},
          sourceImages,
          referenceImages,
          images: (item.generatedImages ?? []).map((url, index) => ({
            url,
            index,
            generationId: item.id,
            prompt: item.resolvedPrompt,
            sourceImages,
            referenceImages,
          })),
        };
      }),
      total,
      page: safePage,
      pageSize: safePageSize,
      hasMore: skip + items.length < total,
    };
  }

  @Post('workbench/generate')
  async generateForWorkbench(
    @Req() req: Request,
    @Body()
    body: {
      model: string;
      chatModelId?: string;
      prompt?: string;
      editInstruction?: string;
      n?: number;
      sourceImages?: Array<{
        url: string;
        prompt?: string;
        generationId?: string;
        index?: number;
      }>;
      referenceImages?: Array<{
        url: string;
        prompt?: string;
        generationId?: string;
        index?: number;
      }>;
      settings?: {
        size?: string;
        quality?: string;
        [key: string]: unknown;
      };
    },
  ) {
    const userId = (req.user as { userId: string }).userId;
    if (!body.model) throw new BadRequestException('请选择图片模型');
    const prompt = (body.editInstruction ?? body.prompt)?.trim();
    if (!prompt) throw new BadRequestException('请输入提示词');

    const templateId = await this.ensureWorkbenchTemplate(userId);

    const request = await this.imageGenerationFlowService.resolveImageRequest({
      userId,
      templateId,
      modelConfigId: body.model,
      chatModelId: body.chatModelId,
      promptOverride: prompt,
      sourceImages: body.sourceImages,
      referenceImages: body.referenceImages,
      settings: body.settings,
    });

    const startedAt = Date.now();
    const { images, appliedSettings } = await this.imageGenerationFlowService.callImageApi(
      request,
      Math.max(1, Math.min(body.n ?? 1, 4)),
    );
    const uploadedImages =
      await this.imageGenerationFlowService.uploadGeneratedImages(images);
    const persisted = await this.imageGenerationFlowService.persistImageResult(
      {
        userId,
        templateId,
        modelConfigId: body.model,
        chatModelId: body.chatModelId,
        promptOverride: prompt,
        sourceImages: body.sourceImages,
        referenceImages: body.referenceImages,
        settings: body.settings,
      },
      request,
      uploadedImages,
      Date.now() - startedAt,
    );

    return {
      images: persisted.images,
      prompt: request.prompt,
      model: request.modelConfig.model,
      appliedSettings,
    };
  }

  @Post('generate')
  async generate(@Req() req: Request, @Res() res: Response) {
    const { baseUrl, apiKey } = extractAmuxHeaders(req);
    const upstream = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const data = await upstream.arrayBuffer();
    res.send(Buffer.from(data));
  }

  @Post('chat')
  async chat(@Req() req: Request, @Res() res: Response) {
    const { baseUrl, apiKey } = extractAmuxHeaders(req);
    const body = req.body;
    const isStream = body?.stream === true;

    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    res.status(upstream.status);

    if (isStream && upstream.body) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        res.end();
      }
      return;
    }

    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const data = await upstream.arrayBuffer();
    res.send(Buffer.from(data));
  }

  @Get('models')
  async models(@Req() req: Request, @Res() res: Response) {
    const { baseUrl, apiKey } = extractAmuxHeaders(req);
    const upstream = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const data = await upstream.arrayBuffer();
    res.send(Buffer.from(data));
  }
}
