import { PointHoldStatus } from '../../../platform/prisma/generated';
import { PointsRepository } from './points.repository';

describe('PointsRepository.countActiveHoldsByType', () => {
  it('counts only PENDING/PROCESSING holds of the given user + taskType', async () => {
    const count = vi.fn(async () => 2);
    const prisma: any = { point_holds: { count } };
    const repo = new PointsRepository(prisma);

    const result = await repo.countActiveHoldsByType('user-1', 'image_generation');

    expect(result).toBe(2);
    expect(count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        taskType: 'image_generation',
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
    });
  });
});
