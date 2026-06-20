import { Injectable } from '@nestjs/common';
import { VideoGenStatus } from '../../platform/prisma/generated';
import { VideoGenerationHoldReconciliationService } from './video-generation-hold-reconciliation.service';

const TERMINAL_STATUSES = new Set<VideoGenStatus>([
  VideoGenStatus.completed,
  VideoGenStatus.failed,
  VideoGenStatus.expired,
]);

export function isTerminalVideoGenerationStatus(status: VideoGenStatus) {
  return TERMINAL_STATUSES.has(status);
}

@Injectable()
export class VideoGenerationTerminalConvergenceService {
  constructor(
    private readonly holdReconciliation: VideoGenerationHoldReconciliationService,
  ) {}

  async reconcileIfTerminal(generation: {
    id: string;
    status: VideoGenStatus;
  }): Promise<boolean> {
    if (!isTerminalVideoGenerationStatus(generation.status)) return false;
    await this.holdReconciliation.reconcileTerminalHold(generation);
    return true;
  }
}
