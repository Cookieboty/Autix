import { ResourceType } from '../platform/prisma/generated';
import { MarketplaceResourceRepository } from './marketplace-resource.repository';

function createPrismaMock() {
  return {
    skills: {
      findMany: jest.fn().mockResolvedValue([{ id: 's1', title: 'Skill' }]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    mcp_servers: {
      findMany: jest.fn().mockResolvedValue([{ id: 'm1', title: 'MCP' }]),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'm1' }),
    },
    agents: {
      findMany: jest.fn().mockResolvedValue([{ id: 'a1', title: 'Agent' }]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    image_templates: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    video_templates: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('MarketplaceResourceRepository', () => {
  it('batch loads resources by type and keeps input row order', async () => {
    const prisma = createPrismaMock();
    const repository = new MarketplaceResourceRepository(prisma as never);

    const rows = [
      { resourceType: ResourceType.MCP, resourceId: 'm1', marker: 'first' },
      { resourceType: ResourceType.SKILL, resourceId: 's1', marker: 'second' },
      {
        resourceType: ResourceType.AGENT,
        resourceId: 'missing',
        marker: 'third',
      },
    ];

    const result = await repository.attachResources(rows);

    expect(prisma.mcp_servers.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['m1'] } },
    });
    expect(prisma.skills.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['s1'] } },
    });
    expect(prisma.agents.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['missing'] } },
    });
    expect(result.map((row) => row.marker)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(result[0].resource?.title).toBe('MCP');
    expect(result[1].resource?.title).toBe('Skill');
    expect(result[2].resource).toBeUndefined();
  });

  it('increments use count only for acquisitable resources', async () => {
    const prisma = createPrismaMock();
    const repository = new MarketplaceResourceRepository(prisma as never);

    await repository.incrementUseCount(ResourceType.MCP, 'm1');
    await repository.incrementUseCount(ResourceType.IMAGE_TEMPLATE, 'img1');

    expect(prisma.mcp_servers.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { useCount: { increment: 1 } },
    });
    expect(prisma.image_templates.update).not.toHaveBeenCalled();
  });
});
