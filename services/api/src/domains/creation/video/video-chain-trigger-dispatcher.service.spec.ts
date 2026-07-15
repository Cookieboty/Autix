import { VideoClipStatus } from '../../platform/prisma/generated';
import { VideoChainTriggerDispatcherService } from './video-chain-trigger-dispatcher.service';

function makeService(options: { nextClip?: Record<string, unknown> | null }) {
  const repository = {
    findClipOrder: vi.fn(async () => ({ order: 1 })),
    findNextChainedPendingClip: vi.fn(async () => options.nextClip ?? null),
  };
  const service = new VideoChainTriggerDispatcherService(repository as never);
  const generateClip = vi.fn(async () => ({ generationId: 'gen-2' }));

  return { service, repository, generateClip };
}

describe('VideoChainTriggerDispatcherService', () => {
  it('triggers the next pending chained clip', async () => {
    const { service, repository, generateClip } = makeService({
      nextClip: {
        id: 'clip-2',
        status: VideoClipStatus.pending,
        chainFromPrev: true,
      },
    });

    await service.triggerNextClipIfNeeded(
      { clipId: 'clip-1', projectId: 'project-1', userId: 'user-1' },
      generateClip,
    );

    expect(repository.findNextChainedPendingClip).toHaveBeenCalledWith(
      'project-1',
      1,
    );
    expect(generateClip).toHaveBeenCalledWith({
      clipId: 'clip-2',
      projectId: 'project-1',
      userId: 'user-1',
    });
  });

  it('does not trigger independent or already-started clips', async () => {
    const { service, generateClip } = makeService({
      nextClip: {
        id: 'clip-2',
        status: VideoClipStatus.generating,
        chainFromPrev: true,
      },
    });

    await service.triggerNextClipIfNeeded(
      { clipId: 'clip-1', projectId: 'project-1', userId: 'user-1' },
      generateClip,
    );

    expect(generateClip).not.toHaveBeenCalled();
  });

  it('logs and swallows downstream trigger failures', async () => {
    const { service, generateClip } = makeService({
      nextClip: {
        id: 'clip-2',
        status: VideoClipStatus.pending,
        chainFromPrev: true,
      },
    });
    generateClip.mockRejectedValue(new Error('provider unavailable'));

    await expect(
      service.triggerNextClipIfNeeded(
        { clipId: 'clip-1', projectId: 'project-1', userId: 'user-1' },
        generateClip,
      ),
    ).resolves.toBeUndefined();
  });
});
