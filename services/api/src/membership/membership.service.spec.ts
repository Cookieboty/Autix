import { BadRequestException } from '@nestjs/common';
import { MembershipService, type VideoEntitlement } from './membership.service';

// P2-D1: 视频闸门覆盖 —— 未订阅 / 等级不允许时必须拒绝 seedance 调用
describe('MembershipService.video gating', () => {
  function buildService(membership: any) {
    const prisma = {
      user_memberships: {
        findUnique: jest.fn().mockResolvedValue(membership),
      },
    } as any;
    return new MembershipService(prisma);
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
