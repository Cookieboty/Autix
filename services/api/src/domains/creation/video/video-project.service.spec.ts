import { VideoProjectRepository } from './video-project.repository';
import { VideoProjectService } from './video-project.service';

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
});
