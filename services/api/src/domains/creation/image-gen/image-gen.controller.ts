import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { ImageGenerationFlowService } from '../llm/workflow/image-generation-flow.service';
import { ImageWorkbenchService } from './image-workbench.service';
import type { AuthUser } from '@autix/domain';
import { mergeAnnotationDataUrls } from './image-merge-annotation';
import { GalleryService } from '../gallery/gallery.service';
import { buildGallerySubmissionDto, deriveAspectRatioFromSize } from './image-gen-gallery-submission';
import { MembershipService } from '../../billing/membership/membership.service';
import { PointsService } from '../../billing/points/points.service';
import { IMAGE_GENERATION_TASK_TYPE } from '../llm/workflow/image-generation-flow.holds';
import { GenerationTaskRepository } from '../../platform/generation-tasks/generation-task.repository';
import { GenerationKind } from '../../platform/prisma/generated';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

@UseGuards(JwtAuthGuard)
@Controller('image-gen')
export class ImageGenController {
  private readonly logger = new AppLogger(ImageGenController.name);

  constructor(
    private readonly imageGenerationFlowService: ImageGenerationFlowService,
    private readonly imageWorkbenchService: ImageWorkbenchService,
    private readonly galleryService: GalleryService,
    private readonly membershipService: MembershipService,
    private readonly pointsService: PointsService,
    private readonly generationTaskRepository: GenerationTaskRepository,
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

  /** 返回当前用户未终态（PENDING/QUEUED）的 IMAGE 任务，供刷新后还原骨架卡使用。 */
  @Get('workbench/active-tasks')
  async listActiveWorkbenchTasks(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    const rows = await this.generationTaskRepository.findActiveTasksByUserAndKind(
      userId,
      GenerationKind.IMAGE,
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        prompt: row.prompt ?? '',
        model: row.model,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        settings: this.extractSettingsFromParamsSnapshot(row.paramsSnapshot),
      })),
    };
  }

  private extractSettingsFromParamsSnapshot(
    snapshot: unknown,
  ): Record<string, unknown> {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return {};
    }
    const settings = (snapshot as { settings?: unknown }).settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return {};
    }
    return settings as Record<string, unknown>;
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
    if (!body.model) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.image_gen.model_required');
    const prompt = body.prompt?.trim();
    if (!prompt) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.prompt_required');

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
    if (!body.imageUrl) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.image_gen.missing_source_image');
    if (!body.overlayDataUrl) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.image_gen.missing_annotation');

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
      count?: number;
    },
  ) {
    const userId = getCurrentUserId(user);
    if (!body.model) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.image_gen.model_required');
    const prompt = (body.editInstruction ?? body.prompt)?.trim();
    if (!prompt) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.prompt_required');

    // 张数：1-4；非法值向下钳到 1，不做上限业务判定 —— 上限交给会员并发闸门决定，
    // 前端已经按会员等级预览过限制，这里再兜底一次防脏请求。
    const requestedCount = Math.min(
      4,
      Math.max(1, Number.isFinite(body.count) ? Math.floor(Number(body.count)) : 1),
    );

    // 会员并发预检查：一次性请求 N 张必须与已在途的 hold 合起来不超过等级 concurrency。
    // 超限直接抛 ImageConcurrencyLimitException（TOO_MANY_REQUESTS）由前端弹 modal。
    // 单张 generateAndPersistImage 内部也会再校验一次（value=1），双保险。
    const imageEntitlement =
      await this.membershipService.resolveImageEntitlements(userId);
    const activeImageHolds = await this.pointsService.countActiveHoldsByType(
      userId,
      IMAGE_GENERATION_TASK_TYPE,
    );
    this.membershipService.assertImageConcurrency(
      activeImageHolds,
      imageEntitlement,
      requestedCount,
    );

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
    const dispatchInput = {
      userId,
      templateId,
      modelConfigId: body.model,
      chatModelId: body.chatModelId,
      promptOverride: prompt,
      sourceImages: body.sourceImages,
      referenceImages: body.referenceImages,
      settings: body.settings,
    };

    // 「同参数并发调 N 次」而不是「一次调用生成 N 张」：多图生成语义等价于用户
    // 手动连点 N 次生成 —— 每次都独立走 hold / 计费 / 落库 / 上传，可单独失败/重试，
    // 也符合服务端既有的一次上游一次落库结构；把 count 直接透给底层 llm 反而需要
    // adapter 侧支持 batch，风险更大。allSettled 允许部分成功。
    const settled = await Promise.allSettled(
      Array.from({ length: requestedCount }, () =>
        this.imageGenerationFlowService.generateAndPersistImage(
          dispatchInput,
          request,
          1,
          { persistedRequest },
        ),
      ),
    );

    const successes = settled
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<ImageGenerationFlowService['generateAndPersistImage']>>> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);
    const failures = settled.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    if (successes.length === 0) {
      // 全失败：把第一条错误抛回，保持既有单张失败的错误语义（含 IMAGE_CONCURRENCY_LIMIT_EXCEEDED 等）。
      const firstError = failures[0]?.reason;
      throw firstError instanceof Error
        ? firstError
        : new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.image_gen.generation_failed');
    }

    // 部分失败：记录日志，仅返回成功的图；前端骨架卡按 count 数量占位，成功数 < count 时
    // 会看到少于预期的成品，可从 toast/日志排查。
    if (failures.length > 0) {
      this.logger.warn(
        `image workbench partial failure: user=${userId} requested=${requestedCount} succeeded=${successes.length} failed=${failures.length} firstReason=${
          failures[0]?.reason instanceof Error
            ? (failures[0].reason as Error).message
            : String(failures[0]?.reason)
        }`,
      );
    }

    // 聚合多次生成的 images：以第一条成功结果的 prompt / model / appliedSettings 为准。
    const primary = successes[0]!;
    const aggregatedImages = successes.flatMap((r, runIndex) =>
      r.images.map((img, idxInRun) => ({
        ...img,
        index: runIndex * (r.images.length || 1) + idxInRun,
      })),
    );

    if (body.visibility === 'public') {
      // 每一次成功的生成各自独立提交画廊，保持既有「一次生成一次审核」语义。
      for (const result of successes) {
        await this.submitToGalleryBestEffort(userId, result, body.settings?.size);
      }
    }

    return {
      images: aggregatedImages,
      prompt: primary.prompt,
      model: primary.model,
      appliedSettings: primary.appliedSettings,
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
