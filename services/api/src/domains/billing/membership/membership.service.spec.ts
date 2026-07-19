import { MembershipService, type VideoEntitlement } from './membership.service';

// P2-D1: 视频闸门覆盖 —— 未订阅 / 未配置视频权益时必须拒绝 seedance 调用
describe('MembershipService.video gating', () => {
  function buildService(membership: any) {
    const repository = {
      findUserMembershipWithLevel: vi.fn().mockResolvedValue(membership),
    } as any;
    return new MembershipService(repository, {} as any);
  }

  it('未订阅用户 resolveVideoEntitlements 返回 enabled=false', async () => {
    const service = buildService(null);
    const ent = await service.resolveVideoEntitlements('u1');
    expect(ent.enabled).toBe(false);
    expect(ent.source).toBe('free_default');
  });

  it('未订阅用户调用 assertVideoEntitlement 直接拒绝 seedance', async () => {
    const service = buildService(null);
    const ent = await service.resolveVideoEntitlements('u1');
    expect(() =>
      service.assertVideoEntitlement(ent, {
        resolution: '720p',
        durationSeconds: 5,
      }),
    ).toThrow(
      expect.objectContaining({
        i18nKey: 'video_entitlement.membership_required',
        code: 'VIDEO_MEMBERSHIP_REQUIRED',
      }),
    );
  });

  it('已订阅但 seedance 未开通时同样拒绝', async () => {
    const service = buildService({
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 86_400_000),
      level: {
        name: '基础版',
        level: 1,
        features: { seedance: { enabled: false } },
      },
    });
    const ent = await service.resolveVideoEntitlements('u1');
    expect(ent.enabled).toBe(false);
    expect(() =>
      service.assertVideoEntitlement(ent, {
        resolution: '480p',
        durationSeconds: 5,
      }),
    ).toThrow(
      expect.objectContaining({
        i18nKey: 'video_entitlement.membership_required',
        code: 'VIDEO_MEMBERSHIP_REQUIRED',
      }),
    );
  });

  it('已订阅但分辨率/时长超额 -> 拒绝', () => {
    const service = buildService(null);
    const entitlement: VideoEntitlement = {
      enabled: true,
      maxResolution: '720p',
      maxDurationSeconds: 5,
      concurrency: 1,
      levelName: 'Pro',
      level: 2,
      source: 'membership',
    };
    expect(() =>
      service.assertVideoEntitlement(entitlement, {
        resolution: '1080p',
        durationSeconds: 5,
      }),
    ).toThrow(
      expect.objectContaining({
        i18nKey: 'video_entitlement.resolution_exceeded',
        code: 'VIDEO_MEMBERSHIP_LIMIT_EXCEEDED',
      }),
    );
    expect(() =>
      service.assertVideoEntitlement(entitlement, {
        resolution: '720p',
        durationSeconds: 10,
      }),
    ).toThrow(
      expect.objectContaining({
        i18nKey: 'video_entitlement.duration_exceeded',
        code: 'VIDEO_MEMBERSHIP_LIMIT_EXCEEDED',
      }),
    );
  });
});

describe('MembershipService.admin writes', () => {
  function buildAdminWriteService() {
    const repository = {
      createLevel: vi.fn().mockResolvedValue({ id: 'level-1' }),
      updateLevel: vi.fn().mockResolvedValue({ id: 'level-1' }),
      createPlan: vi.fn().mockResolvedValue({ id: 'plan-1' }),
      updatePlan: vi.fn().mockResolvedValue({ id: 'plan-1' }),
    } as any;
    return { repository, service: new MembershipService(repository, {} as any) };
  }

  it('creates membership levels with Prisma schema fields from admin UI payload', async () => {
    const { repository, service } = buildAdminWriteService();

    await service.createLevel({
      name: 'Creator',
      level: 2,
      monthlyPrice: '9.90',
      pointsPerMonth: 6500,
      features: ['commercial license'],
      isActive: true,
      sort: 20,
      code: 'legacy-code',
      description: 'legacy description',
    });

    expect(repository.createLevel).toHaveBeenCalledWith({
      name: 'Creator',
      level: 2,
      monthlyPrice: '9.90',
      pointsPerMonth: 6500,
      features: ['commercial license'],
      isActive: true,
      sort: 20,
    });
  });

  it('creates membership plans with current billing contract', async () => {
    const { repository, service } = buildAdminWriteService();

    await service.createPlan({
      levelId: 'level-1',
      billingCycle: 'YEARLY',
      months: 12,
      autoRenew: true,
      originalPrice: '118.80',
      price: '99.00',
      firstTimePrice: '',
      discountLabel: 'Yearly discount',
      firstTimeLabel: null,
      points: 6500,
      isActive: true,
      name: 'legacy name',
      durationMonths: 12,
    });

    expect(repository.createPlan).toHaveBeenCalledWith({
      levelId: 'level-1',
      billingCycle: 'YEARLY',
      months: 12,
      autoRenew: true,
      originalPrice: '118.80',
      price: '99.00',
      firstTimePrice: null,
      discountLabel: 'Yearly discount',
      firstTimeLabel: null,
      points: 6500,
      isActive: true,
    });
  });

  it('supports partial plan updates', async () => {
    const { repository, service } = buildAdminWriteService();

    await service.updatePlan('plan-1', { isActive: false });

    expect(repository.updatePlan).toHaveBeenCalledWith('plan-1', { isActive: false });
  });

  it('rejects non-recurring membership plans', async () => {
    const { repository, service } = buildAdminWriteService();

    await expect(
      service.createPlan({
        levelId: 'level-1',
        billingCycle: 'MONTHLY',
        months: 1,
        autoRenew: false,
        originalPrice: '19.90',
        price: '19.90',
        points: 11000,
      }),
    ).rejects.toMatchObject({ i18nKey: 'membership.plan_must_be_subscription' });
    expect(repository.createPlan).not.toHaveBeenCalled();
  });

  it('rejects quarterly membership plans', async () => {
    const { repository, service } = buildAdminWriteService();

    await expect(
      service.createPlan({
        levelId: 'level-1',
        billingCycle: 'QUARTERLY',
        months: 3,
        autoRenew: true,
        originalPrice: '59.70',
        price: '59.70',
        points: 11000,
      }),
    ).rejects.toMatchObject({ i18nKey: 'membership.plan_billing_cycle_invalid' });
    expect(repository.createPlan).not.toHaveBeenCalled();
  });

  it('ignores blank optional level sort values from admin forms', async () => {
    const { repository, service } = buildAdminWriteService();

    await service.updateLevel('level-1', {
      features: { seedance: { enabled: true } },
      sort: '',
    });

    expect(repository.updateLevel).toHaveBeenCalledWith('level-1', {
      features: { seedance: { enabled: true } },
    });
  });

  it('returns a friendly conflict when membership level number is duplicated', async () => {
    const { repository, service } = buildAdminWriteService();
    repository.updateLevel.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.updateLevel('level-1', { level: 3 })).rejects.toMatchObject({
      i18nKey: 'membership.tier_level_taken',
    });
    expect(repository.updateLevel).toHaveBeenCalledTimes(1);
  });
});

// 订阅自助管理：期末取消 + Stripe 账单门户。此前 membership.service 只覆盖权益/后台 CRUD，
// 这两个直接对接 Stripe 的用户侧入口无任何测试。
describe('MembershipService.subscription self-service', () => {
  function buildService(membership: any) {
    const repository = {
      findUserMembership: vi.fn().mockResolvedValue(membership),
      cancelUserMembershipAtPeriodEnd: vi
        .fn()
        .mockResolvedValue({ id: 'm1', cancelAtPeriodEnd: true }),
    } as any;
    const stripe = {
      cancelSubscriptionAtPeriodEnd: vi.fn().mockResolvedValue(undefined),
      createBillingPortalSession: vi
        .fn()
        .mockResolvedValue({ url: 'https://billing.stripe.test/session' }),
    } as any;
    return { service: new MembershipService(repository, stripe), repository, stripe };
  }

  describe('cancelAtPeriodEnd', () => {
    it('无有效会员时拒绝，且不触碰 Stripe / DB', async () => {
      const { service, repository, stripe } = buildService(null);

      await expect(service.cancelAtPeriodEnd('u1')).rejects.toMatchObject({
        i18nKey: 'membership.no_active_cancellable',
      });
      expect(stripe.cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
      expect(repository.cancelUserMembershipAtPeriodEnd).not.toHaveBeenCalled();
    });

    it('会员非 ACTIVE 时拒绝', async () => {
      const { service, repository } = buildService({
        status: 'CANCELLED',
        stripeSubscriptionId: 'sub_1',
      });

      await expect(service.cancelAtPeriodEnd('u1')).rejects.toMatchObject({
        i18nKey: 'membership.no_active_cancellable',
      });
      expect(repository.cancelUserMembershipAtPeriodEnd).not.toHaveBeenCalled();
    });

    it('有订阅号时先取消 Stripe 订阅再落库', async () => {
      const { service, repository, stripe } = buildService({
        status: 'ACTIVE',
        stripeSubscriptionId: 'sub_1',
      });

      await service.cancelAtPeriodEnd('u1');

      expect(stripe.cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith('sub_1');
      expect(repository.cancelUserMembershipAtPeriodEnd).toHaveBeenCalledWith(
        'u1',
        expect.any(Date),
      );
      // 顺序：Stripe 调用早于落库
      expect(
        stripe.cancelSubscriptionAtPeriodEnd.mock.invocationCallOrder[0],
      ).toBeLessThan(
        repository.cancelUserMembershipAtPeriodEnd.mock.invocationCallOrder[0],
      );
    });

    it('无订阅号（纯站内会员）时跳过 Stripe 但仍落库', async () => {
      const { service, repository, stripe } = buildService({
        status: 'ACTIVE',
        stripeSubscriptionId: null,
      });

      await service.cancelAtPeriodEnd('u1');

      expect(stripe.cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
      expect(repository.cancelUserMembershipAtPeriodEnd).toHaveBeenCalledWith(
        'u1',
        expect.any(Date),
      );
    });

    it('Stripe 取消失败时不落库（避免本地与 Stripe 状态脱节）', async () => {
      const { service, repository, stripe } = buildService({
        status: 'ACTIVE',
        stripeSubscriptionId: 'sub_1',
      });
      stripe.cancelSubscriptionAtPeriodEnd.mockRejectedValueOnce(
        new Error('stripe down'),
      );

      await expect(service.cancelAtPeriodEnd('u1')).rejects.toThrow('stripe down');
      expect(repository.cancelUserMembershipAtPeriodEnd).not.toHaveBeenCalled();
    });
  });

  describe('createBillingPortal', () => {
    it('无 stripeCustomerId 时拒绝，且不调用 Stripe', async () => {
      const { service, stripe } = buildService({ stripeCustomerId: null });

      await expect(service.createBillingPortal('u1')).rejects.toMatchObject({
        i18nKey: 'membership.no_billing_management',
      });
      expect(stripe.createBillingPortalSession).not.toHaveBeenCalled();
    });

    it('有 stripeCustomerId 时返回 Stripe 门户会话', async () => {
      const { service, stripe } = buildService({ stripeCustomerId: 'cus_1' });

      const result = await service.createBillingPortal('u1');

      expect(stripe.createBillingPortalSession).toHaveBeenCalledWith('cus_1');
      expect(result).toEqual({ url: 'https://billing.stripe.test/session' });
    });
  });
});
