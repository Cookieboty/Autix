import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VideoGenStatus } from '../prisma/generated';
import type { VideoEntitlement } from '../membership/membership.service';

const VIDEO_RESOLUTION_RANK: Record<string, number> = {
  '480p': 1,
  '720p': 2,
  '1080p': 3,
};

export const RISK_HARD_LIMITS = {
  maxDurationSeconds: 60,
  maxResolution: '1080p' as const,
  maxConcurrencyHardCap: 8,
} as const;

const ACTIVE_VIDEO_STATUSES: VideoGenStatus[] = [
  VideoGenStatus.pending,
  VideoGenStatus.queued,
  VideoGenStatus.running,
];

export interface VideoRiskRequest {
  resolution: '480p' | '720p' | '1080p';
  durationSeconds: number;
}

@Injectable()
export class RiskService {
  constructor(private readonly prisma: PrismaService) {}

  assertHardLimits(req: VideoRiskRequest): void {
    if (req.durationSeconds > RISK_HARD_LIMITS.maxDurationSeconds) {
      throw new BadRequestException(
        `单次视频时长不得超过 ${RISK_HARD_LIMITS.maxDurationSeconds} 秒（硬上限）`,
      );
    }
    const requestRank = VIDEO_RESOLUTION_RANK[req.resolution] ?? 0;
    const hardRank = VIDEO_RESOLUTION_RANK[RISK_HARD_LIMITS.maxResolution] ?? 0;
    if (requestRank > hardRank) {
      throw new BadRequestException(
        `视频分辨率不得超过 ${RISK_HARD_LIMITS.maxResolution}（硬上限）`,
      );
    }
  }

  async assertConcurrency(
    userId: string,
    entitlement: VideoEntitlement,
  ): Promise<{ active: number; limit: number }> {
    const configured = Math.max(1, entitlement.concurrency ?? 1);
    const limit = Math.min(configured, RISK_HARD_LIMITS.maxConcurrencyHardCap);
    const active = await this.prisma.video_clip_generations.count({
      where: {
        userId,
        status: { in: ACTIVE_VIDEO_STATUSES },
      },
    });
    if (active >= limit) {
      throw new BadRequestException(
        `当前会员等级（${entitlement.levelName}）最多同时进行 ${limit} 个视频任务，您已有 ${active} 个进行中，请稍候`,
      );
    }
    return { active, limit };
  }

  async assertVideoRequest(
    userId: string,
    entitlement: VideoEntitlement,
    req: VideoRiskRequest,
  ) {
    this.assertHardLimits(req);
    return this.assertConcurrency(userId, entitlement);
  }
}
