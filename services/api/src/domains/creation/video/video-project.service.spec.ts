import { VideoProjectRepository } from './video-project.repository';
import { VideoProjectService } from './video-project.service';
import {
  VideoClipStatus,
  VideoGenStatus,
  VideoProjectStatus,
} from '../../platform/prisma/generated';

function createService() {
  const prisma = {
    video_projects: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    conversations: {
      create: jest.fn(),
    },
  };
  const modelConfigService = {
    findDefaultByType: jest.fn(),
  };
  const repository = new VideoProjectRepository(prisma as never);
  const service = new VideoProjectService(repository, modelConfigService as never);
  service.getProject = jest.fn().mockResolvedValue({ id: 'project-1', clips: [] }) as never;
  return { service, prisma };
}

describe('VideoProjectService workbench persistence', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-share-secret';
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it('opens the latest storyboard-only workbench project without creating a conversation', async () => {
    const { service, prisma } = createService();
    prisma.video_projects.findFirst.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      title: '专业视频工作台',
      conversationId: null,
    });

    await service.getOrCreateWorkbenchProject('user-1');

    expect(prisma.conversations.create).not.toHaveBeenCalled();
    expect(prisma.video_projects.update).not.toHaveBeenCalled();
    expect(prisma.video_projects.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        clips: {
          some: {},
        },
        NOT: {
          clips: {
            some: {
              generations: {
                some: {},
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('does not create a server draft when no storyboard-only project exists', async () => {
    const { service, prisma } = createService();
    prisma.video_projects.findFirst.mockResolvedValue(null);

    const result = await service.getOrCreateWorkbenchProject('user-1');

    expect(result).toBeNull();
    expect(prisma.conversations.create).not.toHaveBeenCalled();
    expect(prisma.video_projects.create).not.toHaveBeenCalled();
  });

  it('lists history only for projects that have video generations', async () => {
    const { service, prisma } = createService();

    await service.getUserProjects('user-1', 1, 20);

    const expectedWhere = {
      userId: 'user-1',
      clips: {
        some: {
          generations: {
            some: {},
          },
        },
      },
    };
    expect(prisma.video_projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(prisma.video_projects.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('creates a signed share token for owned completed videos', async () => {
    const { service, prisma } = createService();
    const now = new Date('2026-06-21T00:00:00.000Z');
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      title: 'Shared video',
      coverImage: null,
      conversationId: null,
      status: VideoProjectStatus.completed,
      createdAt: now,
      updatedAt: now,
      clips: [
        {
          id: 'clip-1',
          projectId: 'project-1',
          order: 1,
          title: 'Opening',
          prompt: 'Scene prompt',
          params: { duration: 5 },
          chainFromPrev: false,
          status: VideoClipStatus.completed,
          createdAt: now,
          updatedAt: now,
          materials: [],
          generations: [
            {
              id: 'generation-1',
              clipId: 'clip-1',
              projectId: 'project-1',
              userId: 'user-1',
              variantLabel: null,
              model: 'seedance',
              resolvedPrompt: 'Scene prompt',
              params: {},
              seedanceTaskId: null,
              status: VideoGenStatus.completed,
              videoUrl: 'https://cdn.test/video.mp4',
              lastFrameUrl: null,
              thumbnailUrl: 'https://cdn.test/thumb.jpg',
              durationSec: 5,
              error: null,
              externalStatus: null,
              callbackReceivedAt: null,
              createdAt: now,
              completedAt: now,
            },
          ],
        },
      ],
    });

    const share = await service.createProjectShare('project-1', 'user-1');
    const detail = await service.getSharedProject(share.token);

    expect(detail).toMatchObject({
      id: 'project-1',
      title: 'Shared video',
      videoUrl: 'https://cdn.test/video.mp4',
      generationId: 'generation-1',
      totalDurationSec: 5,
    });
  });

  it('rejects share creation when the project has no completed video', async () => {
    const { service, prisma } = createService();
    const now = new Date('2026-06-21T00:00:00.000Z');
    prisma.video_projects.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      title: 'Incomplete video',
      coverImage: null,
      conversationId: null,
      status: VideoProjectStatus.generating,
      createdAt: now,
      updatedAt: now,
      clips: [
        {
          id: 'clip-1',
          projectId: 'project-1',
          order: 1,
          title: null,
          prompt: null,
          params: { duration: 5 },
          chainFromPrev: false,
          status: VideoClipStatus.generating,
          createdAt: now,
          updatedAt: now,
          materials: [],
          generations: [
            {
              id: 'generation-1',
              clipId: 'clip-1',
              projectId: 'project-1',
              userId: 'user-1',
              variantLabel: null,
              model: 'seedance',
              resolvedPrompt: '',
              params: {},
              seedanceTaskId: null,
              status: VideoGenStatus.running,
              videoUrl: null,
              lastFrameUrl: null,
              thumbnailUrl: null,
              durationSec: null,
              error: null,
              externalStatus: null,
              callbackReceivedAt: null,
              createdAt: now,
              completedAt: null,
            },
          ],
        },
      ],
    });

    await expect(service.createProjectShare('project-1', 'user-1')).rejects.toThrow('暂无可分享的视频');
  });
});
