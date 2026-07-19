import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import { VideoClipStatus } from '../../platform/prisma/generated';
import { VideoProjectRepository } from './video-project.repository';

interface ChainGenerationInput {
  clipId: string;
  projectId: string;
  userId: string;
}

@Injectable()
export class VideoChainTriggerDispatcherService {
  private readonly logger = new AppLogger(VideoChainTriggerDispatcherService.name);

  constructor(private readonly repository: VideoProjectRepository) {}

  async triggerNextClipIfNeeded(
    generation: { clipId: string; projectId: string; userId: string },
    generateClip: (input: ChainGenerationInput) => Promise<unknown>,
  ) {
    const clip = await this.repository.findClipOrder(generation.clipId);
    if (!clip) return;

    const nextClip = await this.repository.findNextChainedPendingClip(
      generation.projectId,
      clip.order,
    );

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
