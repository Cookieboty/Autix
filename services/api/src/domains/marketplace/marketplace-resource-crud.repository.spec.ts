import { ResourceType } from '../platform/prisma/generated';
import { MarketplaceResourceCrudRepository } from './marketplace-resource-crud.repository';

function delegateMock() {
  return {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

function createPrismaMock() {
  return {
    skills: delegateMock(),
    mcp_servers: delegateMock(),
    agents: delegateMock(),
    image_templates: delegateMock(),
    video_templates: delegateMock(),
  };
}

describe('MarketplaceResourceCrudRepository', () => {
  it('returns the matching delegate for resource types used by base services', () => {
    const prisma = createPrismaMock();
    const repository = new MarketplaceResourceCrudRepository(prisma as never);

    expect(repository.delegateFor(ResourceType.SKILL)).toBe(prisma.skills);
    expect(repository.delegateFor(ResourceType.MCP)).toBe(prisma.mcp_servers);
    expect(repository.delegateFor(ResourceType.AGENT)).toBe(prisma.agents);
  });

  it('wraps resource-specific create and update calls', async () => {
    const prisma = createPrismaMock();
    const repository = new MarketplaceResourceCrudRepository(prisma as never);

    await repository.createAgent({ title: 'Agent', category: 'general' } as never);
    await repository.updateSkill('s1', { title: 'Skill' });

    expect(prisma.agents.create).toHaveBeenCalledWith({
      data: { title: 'Agent', category: 'general' },
    });
    expect(prisma.skills.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { title: 'Skill' },
    });
  });
});
