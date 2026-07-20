import { describe, expect, it, vi } from 'vitest';
import { generationTaskAdminActions } from './generation-task-admin.actions';

vi.mock('@autix/sdk', () => ({
  generationTaskAdminApi: {
    list: vi.fn().mockResolvedValue({ data: { items: [{ id: 't-1' }], nextCursor: null } }),
    detail: vi.fn().mockResolvedValue({ data: { task: { id: 't-1' }, hold: null, pointsRecords: [] } }),
  },
}));

describe('generationTaskAdminActions', () => {
  it('list 解包 { data } 后返回内层结果', async () => {
    await expect(generationTaskAdminActions.list({ limit: 20 })).resolves.toEqual({
      items: [{ id: 't-1' }],
      nextCursor: null,
    });
  });

  it('detail 同样解包', async () => {
    const detail = await generationTaskAdminActions.detail('t-1');
    expect(detail.task.id).toBe('t-1');
  });
});
