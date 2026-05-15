import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  VideoGenStatus,
  VideoClipStatus,
  VideoProjectStatus,
  PointsSource,
  MessageRole,
  type Prisma,
} from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { CloudflareR2Service } from '../storage/cloudflare-r2.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { SeedanceApiService } from './seedance-api.service';

export interface ClipGenerateInput {
  clipId: string;
  projectId: string;
  userId: string;
  variantLabel?: string;
  callbackUrl?: string;
}

interface ClipParams {
  model?: string;
  resolution?: string;
  ratio?: string;
  duration?: number;
  seed?: number;
  generateAudio?: boolean;
  watermark?: boolean;
  modelConfigId?: string;
}

@Injectable()
export class VideoGenerationFlowService {
  private readonly logger = new Logger(VideoGenerationFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly r2Service: CloudflareR2Service,
    private readonly modelConfigService: ModelConfigService,
    private readonly seedanceApi: SeedanceApiService,
  ) {}

  async generateClip(input: ClipGenerateInput) {
    const clip = await this.prisma.video_clips.findUnique({
      where: { id: input.clipId },
      include: { materials: true, project: true },
    });
    if (!clip) throw new BadRequestException('Clip 不存在');
    if (clip.project.userId !== input.userId)
      throw new BadRequestException('无权操作此项目');

    const params = clip.params as ClipParams;
    const modelConfigId = params.modelConfigId;
    if (!modelConfigId)
      throw new BadRequestException('Clip 未配置模型');

    const modelConfig =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    const apiKey = modelConfig.apiKey;
    if (!apiKey)
      throw new BadRequestException('视频模型缺少 API Key 配置');

    let materials = [...clip.materials];

    if (clip.chainFromPrev) {
      const prevClip = await this.prisma.video_clips.findUnique({
        where: {
          projectId_order: { projectId: input.projectId, order: clip.order - 1 },
        },
      });
      if (prevClip) {
        const prevGen = await this.prisma.video_clip_generations.findFirst({
          where: {
            clipId: prevClip.id,
            status: VideoGenStatus.completed,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (prevGen?.lastFrameUrl) {
          materials = materials.filter((m) => m.role !== 'first_frame');
          materials.unshift({
            id: 'chain_first_frame',
            clipId: input.clipId,
            role: 'first_frame',
            sourceType: 'video_generation',
            sourceId: prevGen.id,
            url: prevGen.lastFrameUrl,
            name: 'Auto from previous clip',
            metadata: null,
            createdAt: new Date(),
          });
        }
      }
    }

    const hasNextClip = await this.prisma.video_clips.findUnique({
      where: {
        projectId_order: { projectId: input.projectId, order: clip.order + 1 },
      },
    });
    const returnLastFrame = !!hasNextClip;

    const content = this.seedanceApi.buildContent(materials, clip.prompt);

    if (content.length === 0)
      throw new BadRequestException('Clip 缺少素材或 prompt');

    const taskRequest = this.seedanceApi.buildTaskRequest({
      model: params.model ?? modelConfig.model,
      content,
      callbackUrl: input.callbackUrl,
      returnLastFrame,
      generateAudio: params.generateAudio,
      resolution: params.resolution,
      ratio: params.ratio,
      duration: params.duration,
      seed: params.seed,
      watermark: params.watermark,
    });

    const generation = await this.prisma.video_clip_generations.create({
      data: {
        clipId: input.clipId,
        projectId: input.projectId,
        userId: input.userId,
        variantLabel: input.variantLabel,
        model: params.model ?? modelConfig.model,
        resolvedPrompt: clip.prompt ?? '',
        params: taskRequest as unknown as Prisma.InputJsonValue,
        status: VideoGenStatus.pending,
      },
    });

    await this.prisma.video_clips.update({
      where: { id: input.clipId },
      data: { status: VideoClipStatus.generating },
    });

    await this.prisma.video_projects.update({
      where: { id: input.projectId },
      data: { status: VideoProjectStatus.generating },
    });

    try {
      const taskResponse = await this.seedanceApi.createTask(
        apiKey,
        taskRequest,
      );

      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: {
          seedanceTaskId: taskResponse.id,
          status: VideoGenStatus.queued,
          externalStatus: 'queued',
        },
      });

      return { generationId: generation.id, taskId: taskResponse.id };
    } catch (err) {
      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: {
          status: VideoGenStatus.failed,
          error:
            err instanceof Error ? err.message : 'Unknown error creating task',
        },
      });
      await this.prisma.video_clips.update({
        where: { id: input.clipId },
        data: { status: VideoClipStatus.failed },
      });
      throw err;
    }
  }

  async handleCallback(taskId: string, payload: Record<string, unknown>) {
    const generation = await this.prisma.video_clip_generations.findFirst({
      where: { seedanceTaskId: taskId },
    });
    if (!generation) {
      this.logger.warn(`Callback for unknown taskId: ${taskId}`);
      return;
    }

    const status = payload.status as string;
    const externalStatus = status;

    if (status === 'succeeded') {
      const videoUrl = await this.downloadAndUploadVideo(
        payload.video_url as string | undefined,
        generation.id,
      );
      const lastFrameUrl = payload.last_frame_url as string | undefined;

      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: {
          status: VideoGenStatus.completed,
          externalStatus,
          videoUrl,
          lastFrameUrl: lastFrameUrl ?? null,
          durationSec: (payload.duration as number) ?? null,
          callbackReceivedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await this.prisma.video_clips.update({
        where: { id: generation.clipId },
        data: { status: VideoClipStatus.completed },
      });

      await this.deductPoints(generation.userId, generation.projectId);
      await this.triggerNextClipIfNeeded(generation);
    } else if (status === 'failed' || status === 'expired') {
      const errorMsg =
        (payload.error as { message?: string })?.message ?? status;

      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: {
          status:
            status === 'expired'
              ? VideoGenStatus.expired
              : VideoGenStatus.failed,
          externalStatus,
          error: errorMsg,
          callbackReceivedAt: new Date(),
        },
      });

      await this.prisma.video_clips.update({
        where: { id: generation.clipId },
        data: { status: VideoClipStatus.failed },
      });
    } else {
      await this.prisma.video_clip_generations.update({
        where: { id: generation.id },
        data: { externalStatus },
      });
    }
  }

  async generateAllClips(projectId: string, userId: string, callbackUrl?: string) {
    const clips = await this.prisma.video_clips.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    if (clips.length === 0)
      throw new BadRequestException('项目无 Clip');

    const firstClip = clips[0];
    return this.generateClip({
      clipId: firstClip.id,
      projectId,
      userId,
      callbackUrl,
    });
  }

  private async triggerNextClipIfNeeded(
    generation: { clipId: string; projectId: string; userId: string },
  ) {
    const clip = await this.prisma.video_clips.findUnique({
      where: { id: generation.clipId },
    });
    if (!clip) return;

    const nextClip = await this.prisma.video_clips.findUnique({
      where: {
        projectId_order: {
          projectId: generation.projectId,
          order: clip.order + 1,
        },
      },
    });

    if (nextClip && nextClip.status === 'pending' && nextClip.chainFromPrev) {
      try {
        await this.generateClip({
          clipId: nextClip.id,
          projectId: generation.projectId,
          userId: generation.userId,
        });
      } catch (err) {
        this.logger.error(
          `Chain trigger failed for clip ${nextClip.id}: ${String(err instanceof Error ? err.message : err)}`,
        );
      }
    } else {
      const allClips = await this.prisma.video_clips.findMany({
        where: { projectId: generation.projectId },
      });
      const allDone = allClips.every(
        (c) => c.status === 'completed' || c.status === 'failed',
      );
      if (allDone) {
        const anyFailed = allClips.some((c) => c.status === 'failed');
        await this.prisma.video_projects.update({
          where: { id: generation.projectId },
          data: {
            status: anyFailed
              ? VideoProjectStatus.failed
              : VideoProjectStatus.completed,
          },
        });
      }
    }
  }

  private async downloadAndUploadVideo(
    sourceUrl: string | undefined,
    generationId: string,
  ): Promise<string | null> {
    if (!sourceUrl) return null;

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) return sourceUrl;

      const buffer = Buffer.from(await response.arrayBuffer());
      const result = await this.r2Service.uploadBuffer(buffer, {
        contentType: 'video/mp4',
        folder: 'amux-studio/video-generations',
        ext: 'mp4',
      });
      return result.publicUrl;
    } catch (err) {
      this.logger.error(
        `Failed to upload video to R2: ${String(err instanceof Error ? err.message : err)}`,
      );
      return sourceUrl;
    }
  }

  private async deductPoints(userId: string, projectId: string) {
    try {
      const taskCost = await this.prisma.task_point_costs.findUnique({
        where: { taskType: 'video_generation' },
      });
      const cost = taskCost?.cost ?? 0;
      if (cost > 0) {
        await this.pointsService.deductPoints(
          userId,
          cost,
          PointsSource.TASK,
          undefined,
          `video-generation: project ${projectId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `deductPoints failed: user=${userId} ${String(err instanceof Error ? err.message : err)}`,
      );
    }
  }

  async persistVideoMessage(
    conversationId: string | null,
    generationId: string,
    videoUrl: string,
    prompt: string,
  ) {
    if (!conversationId) return;

    await this.prisma.messages.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: `视频已生成: ${videoUrl}`,
        metadata: {
          messageType: 'video_result',
          generationId,
          videoUrl,
          prompt,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
