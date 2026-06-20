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
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { ImageGenerationFlowService } from '../llm/workflow/image-generation-flow.service';
import { ImageWorkbenchService } from './image-workbench.service';
import type { AuthUser } from '@autix/types';
import sharp = require('sharp');

const MERGE_IMAGE_TIMEOUT_MS = 15_000;
const MAX_MERGE_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_MERGE_IMAGE_PIXELS = 16_000_000;
const MAX_MERGE_IMAGE_DIMENSION = 8192;
const MAX_MERGE_IMAGE_REDIRECTS = 3;
const MERGE_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function optionalUrlHostname(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function allowedMergeImageHostnames() {
  return new Set(
    [
      'cdn.amux.ai',
      optionalUrlHostname(process.env.DOMAIN),
    ].filter((host): host is string => Boolean(host)),
  );
}

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

  private imageDataUrlToBuffer(value: string): Buffer {
    const match = /^data:image\/([a-z0-9.+-]+);base64,(.+)$/i.exec(value);
    if (!match) throw new BadRequestException('图片数据格式不正确');
    const subtype = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
    const mimeType = `image/${subtype}`;
    if (!MERGE_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('图片格式不支持，请使用 PNG、JPG 或 WebP');
    }
    const base64 = match[2];
    if (Math.floor((base64.length * 3) / 4) > MAX_MERGE_IMAGE_BYTES) {
      throw new BadRequestException('图片过大，无法合成标注');
    }
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength > MAX_MERGE_IMAGE_BYTES) {
      throw new BadRequestException('图片过大，无法合成标注');
    }
    return buffer;
  }

  private isPrivateIpAddress(address: string): boolean {
    const version = isIP(address);
    if (version === 0) return false;
    if (version === 6) {
      const normalized = address.toLowerCase();
      return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
    }
    const parts = address.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  private async assertSafeImageUrl(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('图片地址不正确');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('图片地址协议不支持');
    }
    const hostname = url.hostname.toLowerCase();
    if (!allowedMergeImageHostnames().has(hostname)) {
      throw new BadRequestException('图片地址不允许访问');
    }
    if (hostname === 'localhost' || hostname.endsWith('.local') || this.isPrivateIpAddress(hostname)) {
      throw new BadRequestException('图片地址不允许访问');
    }
    const records = await lookup(hostname, { all: true, verbatim: true }).catch(() => {
      throw new BadRequestException('图片地址无法解析');
    });
    if (records.some((record) => this.isPrivateIpAddress(record.address))) {
      throw new BadRequestException('图片地址不允许访问');
    }
  }

  private async readResponseBuffer(res: globalThis.Response): Promise<Buffer> {
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (contentType && !MERGE_IMAGE_MIME_TYPES.has(contentType)) {
      throw new BadRequestException('图片地址返回的不是可用图片内容');
    }
    const contentLength = Number(res.headers.get('content-length') ?? 0);
    if (contentLength > MAX_MERGE_IMAGE_BYTES) {
      throw new BadRequestException('图片过大，无法合成标注');
    }

    if (!res.body) {
      const fallback = Buffer.from(await res.arrayBuffer());
      if (fallback.byteLength > MAX_MERGE_IMAGE_BYTES) {
        throw new BadRequestException('图片过大，无法合成标注');
      }
      return fallback;
    }

    const reader = res.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MERGE_IMAGE_BYTES) {
        throw new BadRequestException('图片过大，无法合成标注');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  }

  private async readImageBuffer(value: string): Promise<Buffer> {
    if (/^data:image\//i.test(value)) return this.imageDataUrlToBuffer(value);

    let currentUrl = value;
    for (let redirects = 0; redirects <= MAX_MERGE_IMAGE_REDIRECTS; redirects += 1) {
      await this.assertSafeImageUrl(currentUrl);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MERGE_IMAGE_TIMEOUT_MS);
      try {
        const res = await fetch(currentUrl, { signal: controller.signal, redirect: 'manual' });
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location');
          if (!location || redirects === MAX_MERGE_IMAGE_REDIRECTS) {
            throw new BadRequestException('图片地址重定向不可用');
          }
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
        if (!res.ok) throw new BadRequestException(`图片读取失败：${res.status}`);
        return await this.readResponseBuffer(res);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new BadRequestException('图片地址重定向不可用');
  }

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

    const imageBuffer = await this.readImageBuffer(body.imageUrl);
    const overlayBuffer = this.imageDataUrlToBuffer(body.overlayDataUrl);
    const sharpOptions = {
      failOn: 'none' as const,
      limitInputPixels: MAX_MERGE_IMAGE_PIXELS,
    };
    const normalizedImage = await sharp(imageBuffer, sharpOptions)
      .rotate()
      .png()
      .toBuffer();
    const metadata = await sharp(normalizedImage, sharpOptions).metadata();
    if (!metadata.width || !metadata.height) {
      throw new BadRequestException('原图尺寸读取失败');
    }
    if (
      metadata.width > MAX_MERGE_IMAGE_DIMENSION ||
      metadata.height > MAX_MERGE_IMAGE_DIMENSION ||
      metadata.width * metadata.height > MAX_MERGE_IMAGE_PIXELS
    ) {
      throw new BadRequestException('图片尺寸过大，无法合成标注');
    }
    const overlay = await sharp(overlayBuffer, sharpOptions)
      .resize(metadata.width, metadata.height, { fit: 'fill' })
      .png()
      .toBuffer();
    const merged = await sharp(normalizedImage, sharpOptions)
      .composite([{ input: overlay, blend: 'over' }])
      .png()
      .toBuffer();
    if (merged.byteLength > MAX_MERGE_IMAGE_BYTES) {
      throw new BadRequestException('图片过大，无法合成标注');
    }

    return { image: `data:image/png;base64,${merged.toString('base64')}` };
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
      Math.max(1, Math.min(body.n ?? 1, 4)),
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
