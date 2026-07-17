import { OrderRepository } from './order.repository';

// 订阅 webhook -> user_memberships 状态机。
// 这是"一条龙"里续费/到期取消/订阅删除真正落库的地方，之前只有上层 mock 断言"调用了本方法"，
// 本方法自身的分支（未知订阅空跑 / 续费 / 到期取消 / 订阅删除 / status 大小写 / customerId 透传）无直接覆盖。
describe('OrderRepository.syncUserMembershipByStripeSubscriptionId', () => {
  function buildRepo(membership: any) {
    const update = vi.fn().mockImplementation(({ data }: any) => ({ id: 'm1', ...data }));
    const findFirst = vi.fn().mockResolvedValue(membership);
    const prisma = {
      user_memberships: { findFirst, update },
    } as any;
    return { repo: new OrderRepository(prisma), findFirst, update };
  }

  const baseMembership = {
    id: 'm1',
    userId: 'u1',
    expiresAt: new Date('2026-08-01T00:00:00.000Z'),
    cancelledAt: null,
    stripeCustomerId: 'cus_old',
  };

  it('未知订阅（本地无对应会员）时空跑，不写库', async () => {
    const { repo, findFirst, update } = buildRepo(null);

    const result = await repo.syncUserMembershipByStripeSubscriptionId({
      subscriptionId: 'sub_unknown',
      status: 'active',
    });

    expect(result).toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_unknown' },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('续费事件（active + 新账期末）-> 保持 ACTIVE 并顺延到期时间', async () => {
    const { repo, update } = buildRepo(baseMembership);
    const nextPeriodEnd = new Date('2026-09-01T00:00:00.000Z');

    await repo.syncUserMembershipByStripeSubscriptionId({
      subscriptionId: 'sub_1',
      status: 'active',
      currentPeriodEnd: nextPeriodEnd,
      eventType: 'customer.subscription.updated',
    });

    expect(update).toHaveBeenCalledTimes(1);
    const { where, data } = update.mock.calls[0][0];
    expect(where).toEqual({ id: 'm1' });
    expect(data.status).toBe('ACTIVE');
    expect(data.expiresAt).toEqual(nextPeriodEnd);
    expect(data.autoRenew).toBe(true);
    expect(data.cancelAtPeriodEnd).toBe(false);
    expect(data.cancelledAt).toBeNull();
  });

  it('用户预约到期取消（cancelAtPeriodEnd=true，仍 active）-> 保持 ACTIVE 但停止续费并标记 cancelledAt', async () => {
    const { repo, update } = buildRepo(baseMembership);

    await repo.syncUserMembershipByStripeSubscriptionId({
      subscriptionId: 'sub_1',
      status: 'active',
      cancelAtPeriodEnd: true,
      eventType: 'customer.subscription.updated',
    });

    const { data } = update.mock.calls[0][0];
    // 期末取消：账期内仍是有效会员
    expect(data.status).toBe('ACTIVE');
    expect(data.autoRenew).toBe(false);
    expect(data.cancelAtPeriodEnd).toBe(true);
    // 未提供 cancelledAt 且会员原本未取消 -> 落一个时间戳
    expect(data.cancelledAt).toBeInstanceOf(Date);
    // 未提供 currentPeriodEnd -> 到期时间保持不变
    expect(data.expiresAt).toEqual(baseMembership.expiresAt);
  });

  it('订阅删除事件 -> 置为 CANCELLED，且 cancelAtPeriodEnd 归 false', async () => {
    const { repo, update } = buildRepo(baseMembership);
    const cancelledAt = new Date('2026-07-15T00:00:00.000Z');

    await repo.syncUserMembershipByStripeSubscriptionId({
      subscriptionId: 'sub_1',
      eventType: 'customer.subscription.deleted',
      cancelledAt,
    });

    const { data } = update.mock.calls[0][0];
    expect(data.status).toBe('CANCELLED');
    expect(data.autoRenew).toBe(false);
    // 已经彻底结束，不是"期末待取消"
    expect(data.cancelAtPeriodEnd).toBe(false);
    expect(data.cancelledAt).toEqual(cancelledAt);
    // 无 currentPeriodEnd 时，结束态用 cancelledAt 作为到期时间
    expect(data.expiresAt).toEqual(cancelledAt);
  });

  it("Stripe 的 status='canceled'（美式拼写、大写不敏感）也判定为结束态", async () => {
    const { repo, update } = buildRepo(baseMembership);

    await repo.syncUserMembershipByStripeSubscriptionId({
      subscriptionId: 'sub_1',
      status: 'Canceled',
      eventType: 'customer.subscription.updated',
    });

    const { data } = update.mock.calls[0][0];
    expect(data.status).toBe('CANCELLED');
  });

  it('提供 customerId 时回填 stripeCustomerId，未提供时不动该字段', async () => {
    const withCustomer = buildRepo(baseMembership);
    await withCustomer.repo.syncUserMembershipByStripeSubscriptionId({
      subscriptionId: 'sub_1',
      status: 'active',
      customerId: 'cus_new',
      currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(withCustomer.update.mock.calls[0][0].data.stripeCustomerId).toBe('cus_new');

    const withoutCustomer = buildRepo(baseMembership);
    await withoutCustomer.repo.syncUserMembershipByStripeSubscriptionId({
      subscriptionId: 'sub_1',
      status: 'active',
      currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(
      'stripeCustomerId' in withoutCustomer.update.mock.calls[0][0].data,
    ).toBe(false);
  });
});
