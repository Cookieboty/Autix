import { ResourceType } from '../prisma/generated';
import { ResourceInteractionRepository } from './resource-interaction.repository';

/**
 * Plan C Task 7 建、Task 8 复用：findLikedIds/findFavoritedIds 批量成员查询。
 * 镜像 base-resource.service.spec.ts 里 resource_views groupBy(IN) 的验证方式——
 * 一次 findMany({ resourceId: { in: ids } }) 换回命中集合，不逐条查。
 */
function createPrisma(likedRows: string[], favoritedRows: string[]) {
  return {
    resource_likes: {
      findMany: jest.fn().mockResolvedValue(likedRows.map((resourceId) => ({ resourceId }))),
    },
    resource_favorites: {
      findMany: jest.fn().mockResolvedValue(favoritedRows.map((resourceId) => ({ resourceId }))),
    },
  };
}

describe('ResourceInteractionRepository.findLikedIds / findFavoritedIds', () => {
  it('findFavoritedIds 批量返回命中集合', async () => {
    const prisma = createPrisma([], ['a']);
    const repo = new ResourceInteractionRepository(prisma as never);

    const set = await repo.findFavoritedIds('user-1', ResourceType.GALLERY_POST, ['a', 'b', 'c']);

    expect(set.has('a')).toBe(true);
    expect(set.has('c')).toBe(false);
    expect(prisma.resource_favorites.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', resourceType: ResourceType.GALLERY_POST, resourceId: { in: ['a', 'b', 'c'] } },
      select: { resourceId: true },
    });
  });

  it('findLikedIds 批量返回命中集合', async () => {
    const prisma = createPrisma(['a', 'b'], []);
    const repo = new ResourceInteractionRepository(prisma as never);

    const set = await repo.findLikedIds('user-1', ResourceType.GALLERY_POST, ['a', 'b', 'c']);

    expect(set.has('a')).toBe(true);
    expect(set.has('b')).toBe(true);
    expect(set.has('c')).toBe(false);
    expect(prisma.resource_likes.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', resourceType: ResourceType.GALLERY_POST, resourceId: { in: ['a', 'b', 'c'] } },
      select: { resourceId: true },
    });
  });

  it('空 ids 数组直接短路返回空集合，不查库', async () => {
    const prisma = createPrisma([], []);
    const repo = new ResourceInteractionRepository(prisma as never);

    const set = await repo.findFavoritedIds('user-1', ResourceType.GALLERY_POST, []);

    expect(set.size).toBe(0);
    expect(prisma.resource_favorites.findMany).not.toHaveBeenCalled();
  });
});
