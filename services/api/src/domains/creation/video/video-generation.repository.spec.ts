import { describe, expect, it, vi } from 'vitest';
import { VideoGenerationRepository } from './video-generation.repository';

describe('VideoGenerationRepository', () => {
  it('createDirectPendingGeneration 插入 clipId/projectId=null 且不 update 父表', async () => {
    const create = vi.fn().mockResolvedValue({});
    const clipUpdate = vi.fn();
    const projectUpdate = vi.fn();
    const tx = { video_clip_generations: { create }, video_clips: { update: clipUpdate }, video_projects: { update: projectUpdate } };
    const prisma = { $transaction: (fn: any) => fn(tx) } as any;
    const repo = new VideoGenerationRepository(prisma);
    await repo.createDirectPendingGeneration({
      generationId: 'g1', userId: 'u1', model: 'm', resolvedPrompt: 'p',
      params: {} as any, protocolKey: 'ark-video@v3', modelConfigId: 'mc1',
    });
    expect(create.mock.calls[0][0].data).toMatchObject({ clipId: null, projectId: null, userId: 'u1' });
    expect(clipUpdate).not.toHaveBeenCalled();
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it('deleteOwnedDirectGeneration 拒删非终态', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'g1', status: 'queued' });
    const del = vi.fn();
    const repo = new VideoGenerationRepository({ video_clip_generations: { findFirst, delete: del } } as any);
    const r = await repo.deleteOwnedDirectGeneration({ id: 'g1', userId: 'u1' });
    expect(r).toBe('not_terminal');
    expect(del).not.toHaveBeenCalled();
  });
});
