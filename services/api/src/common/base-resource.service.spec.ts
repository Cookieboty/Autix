import { NotFoundException } from '@nestjs/common';
import { ResourceType, TemplateStatus } from '../prisma/generated';
import { BaseResourceService } from './base-resource.service';

const RESOURCE = {
  id: 'tpl-1',
  title: 'Test Template',
  category: 'portrait',
  status: TemplateStatus.APPROVED,
  likeCount: 5,
  favoriteCount: 3,
  useCount: 10,
  authorId: 'author-1',
};

function createDelegate(resource = RESOURCE) {
  return {
    findMany: jest.fn().mockResolvedValue([resource]),
    findUnique: jest.fn().mockResolvedValue(resource),
    create: jest.fn().mockResolvedValue(resource),
    update: jest.fn().mockResolvedValue({ ...resource, likeCount: resource.likeCount + 1 }),
    delete: jest.fn().mockResolvedValue(resource),
    count: jest.fn().mockResolvedValue(1),
  };
}

function createPrisma() {
  return {
    resource_likes: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    resource_favorites: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    resource_views: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

class TestResourceService extends BaseResourceService {
  _delegate: ReturnType<typeof createDelegate>;

  constructor(prisma: any, delegate: ReturnType<typeof createDelegate>) {
    super(prisma);
    this._delegate = delegate;
  }

  protected get delegate() {
    return this._delegate;
  }

  protected get resourceType() {
    return ResourceType.IMAGE_TEMPLATE;
  }
}

function setup(resource = RESOURCE) {
  const delegate = createDelegate(resource);
  const prisma = createPrisma();
  const service = new TestResourceService(prisma, delegate);
  return { service, delegate, prisma };
}

// ── findById ────────────────────────────────────────────────────────────

describe('BaseResourceService.findById', () => {
  it('returns the resource when it exists', async () => {
    const { service } = setup();
    const result = await service.findById('tpl-1');
    expect(result).toEqual(RESOURCE);
  });

  it('throws NotFoundException when resource does not exist', async () => {
    const { service, delegate } = setup();
    delegate.findUnique.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });
});

// ── findAll ─────────────────────────────────────────────────────────────

describe('BaseResourceService.findAll', () => {
  it('returns paginated results with defaults', async () => {
    const { service, delegate } = setup();
    const result = await service.findAll({});
    expect(result).toEqual({
      items: [RESOURCE],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: TemplateStatus.APPROVED }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('filters by category and search', async () => {
    const { service, delegate } = setup();
    await service.findAll({ category: 'portrait', search: 'test' });
    const call = delegate.findMany.mock.calls[0][0];
    expect(call.where.category).toBe('portrait');
    expect(call.where.OR).toEqual([
      { title: { contains: 'test', mode: 'insensitive' } },
      { description: { contains: 'test', mode: 'insensitive' } },
    ]);
  });

  it('sorts by likes', async () => {
    const { service, delegate } = setup();
    await service.findAll({ sort: 'likes' });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { likeCount: 'desc' } }),
    );
  });

  it('sorts by popular', async () => {
    const { service, delegate } = setup();
    await service.findAll({ sort: 'popular' });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { useCount: 'desc' } }),
    );
  });

  it('caps pageSize at 50', async () => {
    const { service, delegate } = setup();
    await service.findAll({ pageSize: 200 });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});

// ── like ────────────────────────────────────────────────────────────────

describe('BaseResourceService.like', () => {
  it('adds like when not yet liked', async () => {
    const { service, delegate, prisma } = setup();
    prisma.resource_likes.findUnique.mockResolvedValue(null);

    const result = await service.like('user-1', 'tpl-1');

    expect(result).toEqual({ liked: true });
    expect(prisma.resource_likes.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        resourceType: ResourceType.IMAGE_TEMPLATE,
        resourceId: 'tpl-1',
      },
    });
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { likeCount: { increment: 1 } },
    });
  });

  it('removes like when already liked (toggle)', async () => {
    const { service, delegate, prisma } = setup();
    prisma.resource_likes.findUnique.mockResolvedValue({
      id: 'like-1',
      userId: 'user-1',
      resourceType: ResourceType.IMAGE_TEMPLATE,
      resourceId: 'tpl-1',
    });

    const result = await service.like('user-1', 'tpl-1');

    expect(result).toEqual({ liked: false });
    expect(prisma.resource_likes.delete).toHaveBeenCalledWith({
      where: { id: 'like-1' },
    });
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { likeCount: { decrement: 1 } },
    });
  });

  it('throws NotFoundException if resource missing', async () => {
    const { service, delegate } = setup();
    delegate.findUnique.mockResolvedValue(null);
    await expect(service.like('user-1', 'missing')).rejects.toThrow(NotFoundException);
  });
});

// ── favorite ────────────────────────────────────────────────────────────

describe('BaseResourceService.favorite', () => {
  it('adds favorite when not yet favorited', async () => {
    const { service, delegate, prisma } = setup();
    prisma.resource_favorites.findUnique.mockResolvedValue(null);

    const result = await service.favorite('user-1', 'tpl-1');

    expect(result).toEqual({ favorited: true });
    expect(prisma.resource_favorites.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        resourceType: ResourceType.IMAGE_TEMPLATE,
        resourceId: 'tpl-1',
      },
    });
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { favoriteCount: { increment: 1 } },
    });
  });

  it('removes favorite when already favorited (toggle)', async () => {
    const { service, delegate, prisma } = setup();
    prisma.resource_favorites.findUnique.mockResolvedValue({
      id: 'fav-1',
      userId: 'user-1',
      resourceType: ResourceType.IMAGE_TEMPLATE,
      resourceId: 'tpl-1',
    });

    const result = await service.favorite('user-1', 'tpl-1');

    expect(result).toEqual({ favorited: false });
    expect(prisma.resource_favorites.delete).toHaveBeenCalledWith({
      where: { id: 'fav-1' },
    });
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { favoriteCount: { decrement: 1 } },
    });
  });

  it('throws NotFoundException if resource missing', async () => {
    const { service, delegate } = setup();
    delegate.findUnique.mockResolvedValue(null);
    await expect(service.favorite('user-1', 'missing')).rejects.toThrow(NotFoundException);
  });
});

// ── recordView ──────────────────────────────────────────────────────────

describe('BaseResourceService.recordView', () => {
  it('creates a view record', async () => {
    const { service, prisma } = setup();
    await service.recordView('user-1', 'tpl-1');
    expect(prisma.resource_views.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        resourceType: ResourceType.IMAGE_TEMPLATE,
        resourceId: 'tpl-1',
      },
    });
  });
});
