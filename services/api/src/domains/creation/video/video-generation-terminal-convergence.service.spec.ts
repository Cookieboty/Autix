import { VideoGenStatus } from '../../platform/prisma/generated';
import {
  isTerminalVideoGenerationStatus,
  VideoGenerationTerminalConvergenceService,
} from './video-generation-terminal-convergence.service';

describe('VideoGenerationTerminalConvergenceService', () => {
  it('classifies only completed, failed, and expired as terminal', () => {
    expect(isTerminalVideoGenerationStatus(VideoGenStatus.completed)).toBe(
      true,
    );
    expect(isTerminalVideoGenerationStatus(VideoGenStatus.failed)).toBe(true);
    expect(isTerminalVideoGenerationStatus(VideoGenStatus.expired)).toBe(true);
    expect(isTerminalVideoGenerationStatus(VideoGenStatus.pending)).toBe(false);
    expect(isTerminalVideoGenerationStatus(VideoGenStatus.queued)).toBe(false);
  });

  it('reconciles holds only for terminal generations', async () => {
    const holdReconciliation = {
      reconcileTerminalHold: jest.fn(async () => undefined),
    };
    const service = new VideoGenerationTerminalConvergenceService(
      holdReconciliation as never,
    );

    await expect(
      service.reconcileIfTerminal({
        id: 'gen-pending',
        status: VideoGenStatus.pending,
      }),
    ).resolves.toBe(false);
    await expect(
      service.reconcileIfTerminal({
        id: 'gen-completed',
        status: VideoGenStatus.completed,
      }),
    ).resolves.toBe(true);

    expect(holdReconciliation.reconcileTerminalHold).toHaveBeenCalledTimes(1);
    expect(holdReconciliation.reconcileTerminalHold).toHaveBeenCalledWith({
      id: 'gen-completed',
      status: VideoGenStatus.completed,
    });
  });
});
