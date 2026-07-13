import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { ImageGenerationFlowService } from '../llm/workflow/image-generation-flow.service';
import { ImageWorkbenchService } from './image-workbench.service';
import type { AuthUser } from '@autix/domain';
import { mergeAnnotationDataUrls } from './image-merge-annotation';
import { GalleryService } from '../gallery/gallery.service';
import { buildGallerySubmissionDto, deriveAspectRatioFromSize } from './image-gen-gallery-submission';

@UseGuards(JwtAuthGuard)
@Controller('image-gen')
export class ImageGenController {
  private readonly logger = new Logger(ImageGenController.name);

  constructor(
    private readonly imageGenerationFlowService: ImageGenerationFlowService,
    private readonly imageWorkbenchService: ImageWorkbenchService,
    private readonly galleryService: GalleryService,
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
      visibility?: 'private' | 'public';
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

    if (body.visibility === 'public') {
      await this.submitToGalleryBestEffort(userId, result, body.settings?.size);
    }

    return {
      images: result.images,
      prompt: result.prompt,
      model: result.model,
      appliedSettings: result.appliedSettings,
    };
  }

  /**
   * 公开生成 → 自动提交画廊审核队列（先审后发，直接 PENDING）。
   * best-effort：投稿失败仅记日志，不影响本次生成结果返回给用户。
   */
  private async submitToGalleryBestEffort(
    userId: string,
    result: { images: Array<{ url: string; generationId: string }> },
    size: string | undefined,
  ): Promise<void> {
    try {
      const dto = buildGallerySubmissionDto({
        images: result.images,
        generationId: result.images[0]?.generationId,
        aspectRatio: deriveAspectRatioFromSize(size),
      });
      if (!dto) return;
      await this.galleryService.createSubmission(userId, dto);
    } catch (err) {
      this.logger.error(
        `gallery auto-submit failed: user=${userId} reason=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
