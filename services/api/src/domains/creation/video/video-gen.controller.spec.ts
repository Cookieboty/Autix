import { VideoGenController } from './video-gen.controller';

describe('VideoGenController', () => {
  it('DELETE 非终态返回 409', async () => {
    const repo = { deleteOwnedDirectGeneration: vi.fn().mockResolvedValue('not_terminal') };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any);
    await expect(ctrl.deleteHistory({ id: 'u1' } as any, 'g1')).rejects.toMatchObject({ status: 409 });
  });

  it('DELETE 不存在返回 400', async () => {
    const repo = { deleteOwnedDirectGeneration: vi.fn().mockResolvedValue('not_found') };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any);
    await expect(ctrl.deleteHistory({ id: 'u1' } as any, 'g1')).rejects.toMatchObject({ status: 400 });
  });

  it('DELETE 成功后无返回体', async () => {
    const repo = { deleteOwnedDirectGeneration: vi.fn().mockResolvedValue('deleted') };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any);
    await expect(ctrl.deleteHistory({ id: 'u1' } as any, 'g1')).resolves.toBeUndefined();
  });

  it('history 返回分页信封', async () => {
    const repo = { findUserDirectGenerations: vi.fn().mockResolvedValue({ generations: [], total: 0 }) };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any);
    const r = await ctrl.history({ id: 'u1' } as any, '1', '20');
    expect(r).toMatchObject({ items: [], total: 0, page: 1, pageSize: 20, hasMore: false });
  });

  it('history pageSize 超过上限时被夹紧', async () => {
    const repo = { findUserDirectGenerations: vi.fn().mockResolvedValue({ generations: [], total: 0 }) };
    const ctrl = new VideoGenController({} as any, repo as any, {} as any);
    await ctrl.history({ id: 'u1' } as any, '1', '999');
    expect(repo.findUserDirectGenerations).toHaveBeenCalledWith({ userId: 'u1', page: 1, pageSize: 60 });
  });

  it('generate 缺少 prompt 返回 400', async () => {
    const directService = { generate: vi.fn() };
    const ctrl = new VideoGenController(directService as any, {} as any, {} as any);
    await expect(
      ctrl.generate({ id: 'u1' } as any, { prompt: '   ' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(directService.generate).not.toHaveBeenCalled();
  });

  it('generate 拒绝无效素材角色', async () => {
    const directService = { generate: vi.fn() };
    const ctrl = new VideoGenController(directService as any, {} as any, {} as any);
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
    const ctrl = new VideoGenController(directService as any, {} as any, {} as any);
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
    const ctrl = new VideoGenController({} as any, repo as any, {} as any);
    await expect(ctrl.getOne({ id: 'u1' } as any, 'g1')).rejects.toMatchObject({ status: 400 });
  });
});
