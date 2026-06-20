import { ForbiddenException } from '@nestjs/common';
import { MaterialsService } from './materials.service';

function activeMembership(level = 1) {
  return {
    membership: {
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 86400000),
      level: { level, name: 'Starter' },
    },
    pointsBalance: 0,
  };
}

function expiredMembership() {
  return {
    membership: {
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 86400000),
      level: { level: 1, name: 'Starter' },
    },
    pointsBalance: 0,
  };
}

describe('MaterialsService', () => {
  it('allows expired members to list assets but blocks add and use', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([[], 0]),
    };
    const service = new MaterialsService(
      repository as never,
      { getUserMembership: jest.fn().mockResolvedValue(expiredMembership()) } as never,
      {} as never,
    );

    await expect(service.list('user-1', {})).resolves.toMatchObject({
      entitlement: { canAdd: false, canUse: false },
    });
    await expect(
      service.create('user-1', {
        type: 'image',
        title: 'asset',
        url: 'https://example.com/a.png',
        sourceType: 'upload',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.useAsset('user-1', 'asset-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates, uses and soft deletes assets for active members', async () => {
    const asset = {
      id: 'asset-1',
      userId: 'user-1',
      type: 'image',
      title: 'asset',
      url: 'https://example.com/a.png',
      sourceType: 'upload',
      tags: [],
      deletedAt: null,
    };
    const repository = {
      create: jest.fn().mockResolvedValue(asset),
      findOwned: jest.fn().mockResolvedValue(asset),
      softDelete: jest.fn().mockResolvedValue({ ...asset, deletedAt: new Date() }),
    };
    const service = new MaterialsService(
      repository as never,
      { getUserMembership: jest.fn().mockResolvedValue(activeMembership()) } as never,
      {} as never,
    );

    await expect(
      service.create('user-1', {
        type: 'image',
        title: ' asset ',
        url: 'https://example.com/a.png',
        sourceType: 'upload',
        tags: [' ref ', 'ref', ''],
      }),
    ).resolves.toMatchObject({ id: 'asset-1' });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'asset',
        tags: ['ref'],
      }),
    );

    await expect(service.useAsset('user-1', 'asset-1')).resolves.toMatchObject({ id: 'asset-1' });
    await expect(service.remove('user-1', 'asset-1')).resolves.toBeUndefined();
    expect(repository.softDelete).toHaveBeenCalledWith('asset-1');
  });
});
