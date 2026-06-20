import { Injectable, Logger } from '@nestjs/common';
import { VideoClipStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

interface ChainGenerationInput {
  clipId: string;
  projectId: string;
  userId: string;
}

@Injectable()
export class VideoChainTriggerDispatcherService {
  private readonly logger = new Logger(VideoChainTriggerDispatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  async triggerNextClipIfNeeded(
    generation: { clipId: string; projectId: string; userId: string },
    generateClip: (input: ChainGenerationInput) => Promise<unknown>,
  ) {
    const clip = await this.prisma.video_clips.findUnique({
      where: { id: generation.clipId },
      select: { order: true },
    });
    if (!clip) return;

    const nextClip = await this.prisma.video_clips.findUnique({
      where: {
        projectId_order: {
          projectId: generation.projectId,
          order: clip.order + 1,
        },
      },
      select: { id: true, status: true, chainFromPrev: true },
    });

    if (
      nextClip &&
      nextClip.status === VideoClipStatus.pending &&
      nextClip.chainFromPrev
    ) {
      try {
        await generateClip({
          clipId: nextClip.id,
          projectId: generation.projectId,
          userId: generation.userId,
        });
      } catch (err) {
        this.logger.error(
          `chain trigger failed for clip ${nextClip.id}: ${String(
            err instanceof Error ? err.message : err,
          )}`,
        );
      }
    }
  }
}
