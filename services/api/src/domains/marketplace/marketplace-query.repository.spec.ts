import { TemplateStatus } from '../platform/prisma/generated';
import { MarketplaceQueryRepository } from './marketplace-query.repository';

function modelMock() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
}

function createPrismaMock() {
  return {
    skills: modelMock(),
    mcp_servers: modelMock(),
    agents: modelMock(),
    image_templates: modelMock(),
    video_templates: modelMock(),
    user_resource_acquisitions: { count: jest.fn().mockResolvedValue(0) },
    image_generations: { findMany: jest.fn().mockResolvedValue([]) },
    video_generations: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('MarketplaceQueryRepository', () => {
  it('loads home categories with approved filters and hides the image workbench template', async () => {
    const prisma = createPrismaMock();
    const repository = new MarketplaceQueryRepository(prisma as never);

    await repository.findHomeCategoryRows(6);

    expect(prisma.skills.findMany).toHaveBeenCalledWith({
      where: { status: TemplateStatus.APPROVED },
      orderBy: { useCount: 'desc' },
      take: 6,
    });
    expect(prisma.image_templates.findMany).toHaveBeenCalledWith({
      where: {
        status: TemplateStatus.APPROVED,
        sourceType: { not: 'SYSTEM' },
      },
      orderBy: [
        { isHot: 'desc' },
        { useCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 6,
    });
  });

  it('loads generation rows with template metadata limited to the requested count', async () => {
    const prisma = createPrismaMock();
    const repository = new MarketplaceQueryRepository(prisma as never);

    await repository.findGenerationRows('u1', 30);

    const expectedArgs = {
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        template: {
          select: { title: true, coverImage: true, category: true },
        },
      },
    };
    expect(prisma.image_generations.findMany).toHaveBeenCalledWith(
      expectedArgs,
    );
    expect(prisma.video_generations.findMany).toHaveBeenCalledWith(
      expectedArgs,
    );
  });
});
