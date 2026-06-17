import { BadRequestException } from '@nestjs/common';
import { RiskService, RISK_HARD_LIMITS } from './risk.service';
import type { VideoEntitlement } from '../membership/membership.service';

function makeEntitlement(over: Partial<VideoEntitlement> = {}): VideoEntitlement {
  return {
    enabled: true,
    maxResolution: '1080p',
    maxDurationSeconds: 30,
    concurrency: 2,
    levelName: 'Pro',
    level: 3,
    source: 'membership',
    ...over,
  };
}

function makePrisma(activeCount: number) {
  return {
    video_clip_generations: {
      count: jest.fn(async () => activeCount),
    },
  } as any;
}

describe('RiskService.assertHardLimits', () => {
  it('P3-2: rejects duration above 60s hard cap', () => {
    const svc = new RiskService(makePrisma(0));
    expect(() =>
      svc.assertHardLimits({ resolution: '720p', durationSeconds: 61 }),
    ).toThrow(BadRequestException);
  });

  it('P3-2: accepts duration at hard cap boundary', () => {
    const svc = new RiskService(makePrisma(0));
    expect(() =>
      svc.assertHardLimits({
        resolution: '720p',
        durationSeconds: RISK_HARD_LIMITS.maxDurationSeconds,
      }),
    ).not.toThrow();
  });
});

describe('RiskService.assertConcurrency', () => {
  it('P3-2: rejects when active video tasks reach configured concurrency', async () => {
    const prisma = makePrisma(2);
    const svc = new RiskService(prisma);
    await expect(
      svc.assertConcurrency('user-1', makeEntitlement({ concurrency: 2 })),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.video_clip_generations.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: { in: expect.any(Array) },
      },
    });
  });

  it('P3-2: caps concurrency at hard cap regardless of configured value', async () => {
    const prisma = makePrisma(RISK_HARD_LIMITS.maxConcurrencyHardCap);
    const svc = new RiskService(prisma);
    await expect(
      svc.assertConcurrency(
        'user-1',
        makeEntitlement({ concurrency: 9999 }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('P3-2: passes when active < limit', async () => {
    const prisma = makePrisma(1);
    const svc = new RiskService(prisma);
    await expect(
      svc.assertConcurrency('user-1', makeEntitlement({ concurrency: 2 })),
    ).resolves.toEqual({ active: 1, limit: 2 });
  });
});
