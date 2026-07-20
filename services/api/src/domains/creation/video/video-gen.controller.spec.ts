import { VideoGenController } from './video-gen.controller';

describe('VideoGenController', () => {
  it('DELETE 非终态返回 409', async () => {
    const repo = { deleteOwnedDirectGeneration: vi.fn().mockResolvedValue('not_terminal') };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any, {} as any);
    await expect(ctrl.deleteHistory({ id: 'u1' } as any, 'g1')).rejects.toMatchObject({ status: 409 });
  });

  it('DELETE 不存在返回 400', async () => {
    const repo = { deleteOwnedDirectGeneration: vi.fn().mockResolvedValue('not_found') };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any, {} as any);
    await expect(ctrl.deleteHistory({ id: 'u1' } as any, 'g1')).rejects.toMatchObject({ status: 400 });
  });

  it('DELETE 成功后无返回体', async () => {
    const repo = { deleteOwnedDirectGeneration: vi.fn().mockResolvedValue('deleted') };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any, {} as any);
    await expect(ctrl.deleteHistory({ id: 'u1' } as any, 'g1')).resolves.toBeUndefined();
  });

  it('history 返回分页信封', async () => {
    const repo = { findUserDirectGenerations: vi.fn().mockResolvedValue({ generations: [], total: 0 }) };
    // history 会批量查活帖以附 galleryPost；空 Map = 都没发布过
    const gallery = { findActivePostsByVideoGenerationIds: vi.fn().mockResolvedValue(new Map()) };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any, gallery as any);
    const r = await ctrl.history({ id: 'u1' } as any, '1', '20');
    expect(r).toMatchObject({ items: [], total: 0, page: 1, pageSize: 20, hasMore: false });
  });

  it('history 有活帖的记录附 galleryPost，没有的不附', async () => {
    // presenter 会读 createdAt/params，最小可用形状即可
    const row = (id: string) => ({ id, createdAt: new Date('2026-01-01T00:00:00Z'), params: {} });
    const generations = [row('g1'), row('g2')] as any;
    const repo = { findUserDirectGenerations: vi.fn().mockResolvedValue({ generations, total: 2 }) };
    const post = { id: 'p1', status: 'PUBLISHED', rejectReason: null };
    const gallery = {
      findActivePostsByVideoGenerationIds: vi.fn().mockResolvedValue(new Map([['g1', post]])),
    };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any, gallery as any);
    const r = await ctrl.history({ id: 'u1' } as any, '1', '20');
    expect((r.items[0] as any).galleryPost).toEqual(post);
    expect((r.items[1] as any).galleryPost).toBeUndefined();
    // 整页一次批量查，不逐条
    expect(gallery.findActivePostsByVideoGenerationIds).toHaveBeenCalledTimes(1);
    expect(gallery.findActivePostsByVideoGenerationIds).toHaveBeenCalledWith('u1', ['g1', 'g2']);
  });

  it('history pageSize 超过上限时被夹紧', async () => {
    const repo = { findUserDirectGenerations: vi.fn().mockResolvedValue({ generations: [], total: 0 }) };
    // history 会批量查活帖以附 galleryPost；空 Map = 都没发布过
    const gallery = { findActivePostsByVideoGenerationIds: vi.fn().mockResolvedValue(new Map()) };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any, gallery as any);
    await ctrl.history({ id: 'u1' } as any, '1', '999');
    expect(repo.findUserDirectGenerations).toHaveBeenCalledWith({ userId: 'u1', page: 1, pageSize: 60 });
  });

  it('history page/pageSize 非数字时回退默认值而非 NaN', async () => {
    const repo = { findUserDirectGenerations: vi.fn().mockResolvedValue({ generations: [], total: 0 }) };
    // history 会批量查活帖以附 galleryPost；空 Map = 都没发布过
    const gallery = { findActivePostsByVideoGenerationIds: vi.fn().mockResolvedValue(new Map()) };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any, gallery as any);
    const r = await ctrl.history({ id: 'u1' } as any, 'abc', 'xyz');
    expect(repo.findUserDirectGenerations).toHaveBeenCalledWith({ userId: 'u1', page: 1, pageSize: 20 });
    expect(r).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('generate 缺少 prompt 返回 400', async () => {
    const directService = { generate: vi.fn() };
    const ctrl = new VideoGenController(directService as any, {} as any, {} as any, {} as any);
    await expect(
      ctrl.generate({ id: 'u1' } as any, { prompt: '   ' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(directService.generate).not.toHaveBeenCalled();
  });

  it('generate 拒绝无效素材角色', async () => {
    const directService = { generate: vi.fn() };
    const ctrl = new VideoGenController(directService as any, {} as any, {} as any, {} as any);
    await expect(
      ctrl.generate({ id: 'u1' } as any, {
        prompt: '一只猫在跳舞',
        materials: [{ role: 'not_a_real_role', url: 'https://x.test/a.png' }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(directService.generate).not.toHaveBeenCalled();
  });

  it('generate 透传合法素材角色给 service', async () => {
    const directService = { generate: vi.fn().mockResolvedValue({ generationId: 'g1', taskId: 't1' }) };
    const ctrl = new VideoGenController(directService as any, {} as any, {} as any, {} as any);
    const materials = [{ role: 'first_frame', url: 'https://x.test/a.png' }];
    const r = await ctrl.generate({ id: 'u1' } as any, { prompt: '一只猫在跳舞', materials });
    expect(directService.generate).toHaveBeenCalledWith({
      userId: 'u1',
      prompt: '一只猫在跳舞',
      materials,
      clientParams: {},
    });
    expect(r).toEqual({ generationId: 'g1', taskId: 't1' });
  });

  it('getOne 记录不存在返回 400', async () => {
    const repo = { findOwnedDirectGeneration: vi.fn().mockResolvedValue(null) };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any, {} as any);
    await expect(ctrl.getOne({ id: 'u1' } as any, 'g1')).rejects.toMatchObject({ status: 400 });
  });
});
