import { BadRequestException } from '@nestjs/common';
import { PointsSource } from '../prisma/generated';
import { PointsService } from './points.service';

function createTx() {
  return {
    user_points: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    points_records: { create: jest.fn().mockResolvedValue({}) },
  };
}

function createPrisma(tx: ReturnType<typeof createTx>) {
  return { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) };
}

describe('PointsService.deductPoints (atomic)', () => {
  it('deducts via guarded conditional update and records CONSUME', async () => {
    const tx = createTx();
    tx.user_points.updateMany.mockResolvedValue({ count: 1 });
    tx.user_points.findUniqueOrThrow.mockResolvedValue({ balance: 40 });
    const service = new PointsService(createPrisma(tx) as never);

    const balance = await service.deductPoints(
      'u1',
      60,
      PointsSource.TASK,
      undefined,
      'remark',
    );

    expect(tx.user_points.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', balance: { gte: 60 } },
      data: { balance: { decrement: 60 } },
    });
    expect(tx.points_records.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'CONSUME', amount: 60, balance: 40 }),
      }),
    );
    expect(balance).toBe(40);
  });

  it('rejects (no record) when guarded update affects no rows', async () => {
    const tx = createTx();
    // count===0 covers both "insufficient balance" and "lost a concurrent race"
    tx.user_points.updateMany.mockResolvedValue({ count: 0 });
    const service = new PointsService(createPrisma(tx) as never);

    await expect(
      service.deductPoints('u1', 60, PointsSource.TASK),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.points_records.create).not.toHaveBeenCalled();
  });
});
