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
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    conversations: {
      create: vi.fn(),
    },
    video_project_shares: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  const modelConfigService = {
    findDefaultByType: vi.fn(),
  };
  const repository = new VideoProjectRepository(prisma as never);
  const service = new VideoProjectService(repository, modelConfigService as never);
  service.getProject = vi.fn().mockResolvedValue({ id: 'project-1', clips: [] }) as never;
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

  it('creates a short share code for owned completed videos', async () => {
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
    prisma.video_project_shares.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if ('projectId_userId' in where) return Promise.resolve(null);
      if ('code' in where) return Promise.resolve({ projectId: 'project-1', userId: 'user-1' });
      return Promise.resolve(null);
    });
    prisma.video_project_shares.create.mockImplementation(({ data }: { data: { code: string; projectId: string; userId: string } }) =>
      Promise.resolve({
        id: 'share-1',
        code: data.code,
        projectId: data.projectId,
        userId: data.userId,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const share = await service.createProjectShare('project-1', 'user-1');
    const detail = await service.getSharedProject(share.code);

    expect(share.code).toHaveLength(8);
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
