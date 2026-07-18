import { describe, expect, it, vi } from 'vitest';
import { VideoMaterialRepository } from './video-material.repository';

describe('VideoMaterialRepository', () => {
  it('findCompletedVideoGenerations 只返回 clip-bound 行（clipId != null）', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repo = new VideoMaterialRepository({ video_clip_generations: { findMany, count } } as any);
    await repo.findCompletedVideoGenerations({ userId: 'u1', page: 1, pageSize: 20 });
    expect(findMany.mock.calls[0][0].where).toMatchObject({ clipId: { not: null } });
  });
});
