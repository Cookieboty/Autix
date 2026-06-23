import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { ImageGenerationFlowService } from '../llm/workflow/image-generation-flow.service';
import { ImageWorkbenchService } from './image-workbench.service';
import type { AuthUser } from '@autix/domain';
import { mergeAnnotationDataUrls } from './image-merge-annotation';

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
    private readonly imageWorkbenchService: ImageWorkbenchService,
  ) {}

  @Get('workbench/history')
  async getWorkbenchHistory(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.imageWorkbenchService.getHistory(userId, page, pageSize);
  }

  @Delete('workbench/history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkbenchHistory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const userId = getCurrentUserId(user);
    await this.imageWorkbenchService.deleteHistoryItem(userId, id);
  }

  @Post('workbench/refine-prompt')
  async refinePromptForWorkbench(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      model: string;
      chatModelId?: string;
      prompt?: string;
      mode?: 'generate' | 'edit';
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
        promptTuning?: string;
        stylePreset?: string;
        negativePrompt?: string;
        [key: string]: unknown;
      };
    },
  ) {
    const userId = getCurrentUserId(user);
    if (!body.model) throw new BadRequestException('请选择图片模型');
    const prompt = body.prompt?.trim();
    if (!prompt) throw new BadRequestException('请输入提示词');

    return this.imageGenerationFlowService.refineWorkbenchPrompt(userId, {
      mode: body.mode ?? (body.sourceImages?.length ? 'edit' : 'generate'),
      prompt,
      imageModelConfigId: body.model,
      chatModelId: body.chatModelId,
      sourceImages: body.sourceImages,
      referenceImages: body.referenceImages,
      settings: body.settings,
    });
  }

  @Post('workbench/merge-annotation')
  async mergeWorkbenchAnnotation(
    @Body()
    body: {
      imageUrl?: string;
      overlayDataUrl?: string;
    },
  ) {
    if (!body.imageUrl) throw new BadRequestException('缺少原图');
    if (!body.overlayDataUrl) throw new BadRequestException('缺少标注');

    return {
      image: await mergeAnnotationDataUrls(body.imageUrl, body.overlayDataUrl),
    };
  }

  @Post('workbench/generate')
  async generateForWorkbench(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      model: string;
      chatModelId?: string;
      prompt?: string;
      editInstruction?: string;
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
    const userId = getCurrentUserId(user);
    if (!body.model) throw new BadRequestException('请选择图片模型');
    const prompt = (body.editInstruction ?? body.prompt)?.trim();
    if (!prompt) throw new BadRequestException('请输入提示词');

    const templateId = await this.imageWorkbenchService.ensureWorkbenchTemplate(userId);
    const generationSettings = { ...body.settings, skipPromptTuning: true };

    const request = await this.imageGenerationFlowService.resolveImageRequest({
      userId,
      templateId,
      modelConfigId: body.model,
      chatModelId: body.chatModelId,
      promptOverride: prompt,
      sourceImages: body.sourceImages,
      referenceImages: body.referenceImages,
      settings: generationSettings,
    });

    const persistedRequest = {
      ...request,
      settings: body.settings,
    };
    const result = await this.imageGenerationFlowService.generateAndPersistImage(
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
      1,
      { persistedRequest },
    );

    return {
      images: result.images,
      prompt: result.prompt,
      model: result.model,
      appliedSettings: result.appliedSettings,
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
