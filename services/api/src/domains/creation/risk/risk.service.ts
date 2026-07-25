import { Injectable, HttpStatus } from '@nestjs/common';
import { VideoGenStatus } from '../../platform/prisma/generated';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import type { VideoEntitlement } from '../../billing/membership/membership.service';
import { RiskRepository } from './risk.repository';
import { VIDEO_RESOLUTION_RANK, type VideoResolution } from '@autix/domain/video';

export const RISK_HARD_LIMITS = {
  maxDurationSeconds: 60,
  maxResolution: '4k' as const,
  maxConcurrencyHardCap: 8,
} as const;

const ACTIVE_VIDEO_STATUSES: VideoGenStatus[] = [
  VideoGenStatus.pending,
  VideoGenStatus.queued,
  VideoGenStatus.running,
];

export interface VideoRiskRequest {
  resolution: VideoResolution;
  durationSeconds: number;
}

@Injectable()
export class RiskService {
  constructor(private readonly riskRepository: RiskRepository) {}

  assertHardLimits(req: VideoRiskRequest): void {
    if (req.durationSeconds > RISK_HARD_LIMITS.maxDurationSeconds) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'creation.video.duration_hard_limit',
        { max: RISK_HARD_LIMITS.maxDurationSeconds },
      );
    }
    const requestRank = VIDEO_RESOLUTION_RANK[req.resolution] ?? 0;
    const hardRank = VIDEO_RESOLUTION_RANK[RISK_HARD_LIMITS.maxResolution] ?? 0;
    if (requestRank > hardRank) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'creation.video.resolution_hard_limit',
        { max: RISK_HARD_LIMITS.maxResolution },
      );
    }
  }

  async assertConcurrency(
    userId: string,
    entitlement: VideoEntitlement,
  ): Promise<{ active: number; limit: number }> {
    const configured = Math.max(1, entitlement.concurrency ?? 1);
    const limit = Math.min(configured, RISK_HARD_LIMITS.maxConcurrencyHardCap);
    const active = await this.riskRepository.countActiveVideoGenerations(
      userId,
      ACTIVE_VIDEO_STATUSES,
    );
    if (active >= limit) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'creation.video.concurrency_limit',
        { level: entitlement.levelName, limit, active },
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
