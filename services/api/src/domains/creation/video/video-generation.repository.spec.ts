import { describe, expect, it, vi } from 'vitest';
import { GenerationTaskRecorder } from '../../platform/generation-tasks/generation-task.recorder';
import { GenerationTaskRepository } from '../../platform/generation-tasks/generation-task.repository';
import { VideoGenerationRepository } from './video-generation.repository';

function makeRecorder(prisma: unknown) {
  return new GenerationTaskRecorder(new GenerationTaskRepository(prisma as never));
}

describe('VideoGenerationRepository', () => {
  it('createDirectPendingGeneration 插入 clipId/projectId=null 且不 update 父表', async () => {
    const create = vi.fn().mockResolvedValue({});
    const clipUpdate = vi.fn();
    const projectUpdate = vi.fn();
    const taskCreate = vi.fn().mockResolvedValue({});
    const tx = {
      video_clip_generations: { create },
      video_clips: { update: clipUpdate },
      video_projects: { update: projectUpdate },
      generation_tasks: { create: taskCreate },
    };
    const prisma = { $transaction: (fn: any) => fn(tx) } as any;
    const repo = new VideoGenerationRepository(prisma, makeRecorder(prisma));
    await repo.createDirectPendingGeneration({
      generationId: 'g1', userId: 'u1', model: 'm', resolvedPrompt: 'p',
      params: {} as any, protocolKey: 'ark-video@v3', modelConfigId: 'mc1',
      task: { provider: 'ark', materialCount: 0, holdId: 'hold-1' },
    });
    // start() 必须与 create 同事务：拿到的是同一个 tx client，不是 this.prisma。
    expect(taskCreate).toHaveBeenCalledTimes(1);
    expect(taskCreate.mock.calls[0][0].data).toMatchObject({
      id: 'g1',
      kind: 'VIDEO',
      videoGenerationId: 'g1',
      holdId: 'hold-1',
    });
    expect(create.mock.calls[0][0].data).toMatchObject({ clipId: null, projectId: null, userId: 'u1' });
    expect(clipUpdate).not.toHaveBeenCalled();
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it('deleteOwnedDirectGeneration 拒删非终态', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'g1', status: 'queued' });
    const del = vi.fn();
    const prisma = { video_clip_generations: { findFirst, delete: del } } as any;
    const repo = new VideoGenerationRepository(prisma, makeRecorder(prisma));
    const r = await repo.deleteOwnedDirectGeneration({ id: 'g1', userId: 'u1' });
    expect(r).toBe('not_terminal');
    expect(del).not.toHaveBeenCalled();
  });
});
