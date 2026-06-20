import { BadRequestException } from '@nestjs/common';
import { MembershipService, type VideoEntitlement } from './membership.service';

// P2-D1: 视频闸门覆盖 —— 未订阅 / 等级不允许时必须拒绝 seedance 调用
describe('MembershipService.video gating', () => {
  function buildService(membership: any) {
    const repository = {
      findUserMembershipWithLevel: jest.fn().mockResolvedValue(membership),
    } as any;
    return new MembershipService(repository);
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
    ).toThrow(BadRequestException);
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
    ).toThrow(/未开通视频生成/);
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
    ).toThrow(/分辨率/);
    expect(() =>
      service.assertVideoEntitlement(entitlement, {
        resolution: '720p',
        durationSeconds: 10,
      }),
    ).toThrow(/秒/);
  });
});

describe('MembershipService.admin writes', () => {
  function buildAdminWriteService() {
    const repository = {
      createLevel: jest.fn().mockResolvedValue({ id: 'level-1' }),
      updateLevel: jest.fn().mockResolvedValue({ id: 'level-1' }),
      createPlan: jest.fn().mockResolvedValue({ id: 'plan-1' }),
      updatePlan: jest.fn().mockResolvedValue({ id: 'plan-1' }),
    } as any;
    return { repository, service: new MembershipService(repository) };
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
      autoRenew: false,
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
      autoRenew: false,
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
});
