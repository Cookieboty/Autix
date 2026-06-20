import {
  VideoClipStatus,
  VideoProjectStatus,
} from '../../platform/prisma/generated';
import { VideoProjectStatusConvergenceService } from './video-project-status-convergence.service';

function makeService(options: { clips?: Array<Record<string, unknown>> } = {}) {
  const prisma = {
    video_clips: {
      findUnique: jest.fn(async () => ({
        id: 'clip-1',
        projectId: 'project-1',
        order: 1,
      })),
      findMany: jest.fn(async () => options.clips ?? []),
      updateMany: jest.fn(),
    },
    video_projects: {
      update: jest.fn(),
    },
  };
  const service = new VideoProjectStatusConvergenceService(prisma as never);

  return { service, prisma };
}

describe('VideoProjectStatusConvergenceService', () => {
  it('keeps the project generating when any clip is pending or generating', async () => {
    const { service, prisma } = makeService({
      clips: [
        { status: VideoClipStatus.completed },
        { status: VideoClipStatus.pending },
      ],
    });

    await service.recalculateProjectStatus('project-1');

    expect(prisma.video_projects.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: VideoProjectStatus.generating },
    });
  });

  it('marks the project failed only when all clips failed', async () => {
    const { service, prisma } = makeService({
      clips: [
        { status: VideoClipStatus.failed },
        { status: VideoClipStatus.failed },
      ],
    });

    await service.recalculateProjectStatus('project-1');

    expect(prisma.video_projects.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: VideoProjectStatus.failed },
    });
  });

  it('marks partial success completed once no pending work remains', async () => {
    const { service, prisma } = makeService({
      clips: [
        { status: VideoClipStatus.completed },
        { status: VideoClipStatus.failed },
      ],
    });

    await service.recalculateProjectStatus('project-1');

    expect(prisma.video_projects.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: VideoProjectStatus.completed },
    });
  });

  it('does not update project status when the project has no clips', async () => {
    const { service, prisma } = makeService({ clips: [] });

    await service.recalculateProjectStatus('project-1');

    expect(prisma.video_projects.update).not.toHaveBeenCalled();
  });

  it('cascades failure only through contiguous pending chain clips', async () => {
    const { service, prisma } = makeService({
      clips: [
        {
          id: 'clip-2',
          order: 2,
          chainFromPrev: true,
          status: VideoClipStatus.pending,
        },
        {
          id: 'clip-3',
          order: 3,
          chainFromPrev: true,
          status: VideoClipStatus.pending,
        },
        {
          id: 'clip-4',
          order: 4,
          chainFromPrev: false,
          status: VideoClipStatus.pending,
        },
        {
          id: 'clip-5',
          order: 5,
          chainFromPrev: true,
          status: VideoClipStatus.pending,
        },
      ],
    });

    await service.cascadeFailDependents('clip-1');

    expect(prisma.video_clips.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['clip-2', 'clip-3'] } },
      data: { status: VideoClipStatus.failed },
    });
  });

  it('stops cascading failure across an order gap', async () => {
    const { service, prisma } = makeService({
      clips: [
        {
          id: 'clip-3',
          order: 3,
          chainFromPrev: true,
          status: VideoClipStatus.pending,
        },
      ],
    });

    await service.cascadeFailDependents('clip-1');

    expect(prisma.video_clips.updateMany).not.toHaveBeenCalled();
  });
});
