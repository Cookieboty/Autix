import { VideoClipStatus } from '../../platform/prisma/generated';
import { VideoChainTriggerDispatcherService } from './video-chain-trigger-dispatcher.service';

function makeService(options: { nextClip?: Record<string, unknown> | null }) {
  const prisma = {
    video_clips: {
      findUnique: jest.fn(async (args: any) => {
        if (args.where?.id === 'clip-1') return { order: 1 };
        if (args.where?.projectId_order) return options.nextClip ?? null;
        return null;
      }),
    },
  };
  const service = new VideoChainTriggerDispatcherService(prisma as never);
  const generateClip = jest.fn(async () => ({ generationId: 'gen-2' }));

  return { service, prisma, generateClip };
}

describe('VideoChainTriggerDispatcherService', () => {
  it('triggers the next pending chained clip', async () => {
    const { service, prisma, generateClip } = makeService({
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

    expect(prisma.video_clips.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        projectId_order: {
          projectId: 'project-1',
          order: 2,
        },
      },
      select: { id: true, status: true, chainFromPrev: true },
    });
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
