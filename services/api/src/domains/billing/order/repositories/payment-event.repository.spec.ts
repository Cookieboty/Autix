import { PaymentEventRepository } from './payment-event.repository';

// 支付事件幂等台账：claimPaymentEvent 是"一条龙"里防止 webhook 重复履约的第一道闸，
// 之前只在 fulfillment 层用 mock repo 间接覆盖，claim 自身的四条分支 + P2002 重试、
// 以及 recoverStaleProcessingEvents 的卡死回收都无直接测试。
describe('PaymentEventRepository.claimPaymentEvent', () => {
  function buildRepo() {
    const tx = {
      payment_events: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation((cb: any) => cb(tx)),
      payment_events: { updateMany: vi.fn() },
    };
    return { repo: new PaymentEventRepository(prisma as any), tx, prisma };
  }

  const input = {
    provider: 'stripe',
    eventId: 'evt_1',
    eventType: 'checkout.session.completed',
  };

  it('事件已处理过 -> 直接返回 alreadyProcessed，不再创建/认领', async () => {
    const { repo, tx } = buildRepo();
    const existing = { id: 'e1', processedAt: new Date() };
    tx.payment_events.findUnique.mockResolvedValue(existing);

    const result = await repo.claimPaymentEvent(input);

    expect(result).toEqual({ event: existing, alreadyProcessed: true });
    expect(tx.payment_events.updateMany).not.toHaveBeenCalled();
    expect(tx.payment_events.create).not.toHaveBeenCalled();
  });

  it('全新事件 -> 创建 PROCESSING 记录并认领成功', async () => {
    const { repo, tx } = buildRepo();
    tx.payment_events.findUnique.mockResolvedValue(null);
    tx.payment_events.create.mockResolvedValue({ id: 'e2', status: 'PROCESSING' });

    const result = await repo.claimPaymentEvent(input);

    expect(tx.payment_events.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      event: { id: 'e2', status: 'PROCESSING' },
      alreadyProcessed: false,
    });
  });

  it('已存在但未处理、可认领（updateMany 命中）-> 认领并回读最新记录', async () => {
    const { repo, tx } = buildRepo();
    tx.payment_events.findUnique
      .mockResolvedValueOnce({ id: 'e3', processedAt: null, status: 'PENDING' })
      .mockResolvedValueOnce({ id: 'e3', status: 'PROCESSING' });
    tx.payment_events.updateMany.mockResolvedValue({ count: 1 });

    const result = await repo.claimPaymentEvent(input);

    expect(tx.payment_events.updateMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      event: { id: 'e3', status: 'PROCESSING' },
      alreadyProcessed: false,
    });
  });

  it('已存在且正被他人处理（updateMany 未命中）-> alreadyProcessing，不重复履约', async () => {
    const { repo, tx } = buildRepo();
    const existing = { id: 'e4', processedAt: null, status: 'PROCESSING' };
    tx.payment_events.findUnique.mockResolvedValue(existing);
    tx.payment_events.updateMany.mockResolvedValue({ count: 0 });

    const result = await repo.claimPaymentEvent(input);

    expect(result).toEqual({ event: existing, alreadyProcessing: true });
    expect(tx.payment_events.create).not.toHaveBeenCalled();
  });

  it('并发插入撞唯一键（P2002）-> 自动重试一次并最终认领', async () => {
    const tx = {
      payment_events: {
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'e5', status: 'PROCESSING' }),
      },
    };
    const $transaction = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockImplementationOnce((cb: any) => cb(tx));
    const prisma = { $transaction, payment_events: { updateMany: vi.fn() } };
    const repo = new PaymentEventRepository(prisma as any);

    const result = await repo.claimPaymentEvent(input);

    expect($transaction).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      event: { id: 'e5', status: 'PROCESSING' },
      alreadyProcessed: false,
    });
  });

  it('非 P2002 的错误直接抛出，不吞不重试', async () => {
    const $transaction = vi.fn().mockRejectedValue({ code: 'P2003' });
    const prisma = { $transaction, payment_events: { updateMany: vi.fn() } };
    const repo = new PaymentEventRepository(prisma as any);

    await expect(repo.claimPaymentEvent(input)).rejects.toMatchObject({
      code: 'P2003',
    });
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});

describe('PaymentEventRepository.recoverStaleProcessingEvents', () => {
  it('把卡在 PROCESSING 且超时的事件回退为 PENDING，并返回回收数量', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const prisma = { payment_events: { updateMany }, $transaction: vi.fn() };
    const repo = new PaymentEventRepository(prisma as any);

    const count = await repo.recoverStaleProcessingEvents();

    expect(count).toBe(3);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where.status).toBe('PROCESSING');
    expect(arg.where.processedAt).toBeNull();
    expect(arg.where.updatedAt.lt).toBeInstanceOf(Date);
    expect(arg.data.status).toBe('PENDING');
  });
});
