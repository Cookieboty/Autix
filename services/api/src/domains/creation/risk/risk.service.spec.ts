import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { RiskService, RISK_HARD_LIMITS } from './risk.service';
import type { VideoEntitlement } from '../../billing/membership/membership.service';

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

function makeRepository(activeCount: number) {
  return {
    countActiveVideoGenerations: vi.fn(async () => activeCount),
  } as any;
}

describe('RiskService.assertHardLimits', () => {
  it('P3-2: rejects duration above 60s hard cap', () => {
    const svc = new RiskService(makeRepository(0));
    let error: unknown;
    try {
      svc.assertHardLimits({ resolution: '720p', durationSeconds: 61 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(I18nHttpException);
    expect(error).toMatchObject({
      status: 400,
      i18nKey: 'creation.video.duration_hard_limit',
    });
  });

  it('P3-2: accepts duration at hard cap boundary', () => {
    const svc = new RiskService(makeRepository(0));
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
    const repository = makeRepository(2);
    const svc = new RiskService(repository);
    await expect(
      svc.assertConcurrency('user-1', makeEntitlement({ concurrency: 2 })),
    ).rejects.toMatchObject({
      status: 400,
      i18nKey: 'creation.video.concurrency_limit',
    });
    expect(repository.countActiveVideoGenerations).toHaveBeenCalledWith(
      'user-1',
      expect.any(Array),
    );
  });

  it('P3-2: caps concurrency at hard cap regardless of configured value', async () => {
    const repository = makeRepository(RISK_HARD_LIMITS.maxConcurrencyHardCap);
    const svc = new RiskService(repository);
    await expect(
      svc.assertConcurrency(
        'user-1',
        makeEntitlement({ concurrency: 9999 }),
      ),
    ).rejects.toMatchObject({
      status: 400,
      i18nKey: 'creation.video.concurrency_limit',
    });
  });

  it('P3-2: passes when active < limit', async () => {
    const repository = makeRepository(1);
    const svc = new RiskService(repository);
    await expect(
      svc.assertConcurrency('user-1', makeEntitlement({ concurrency: 2 })),
    ).resolves.toEqual({ active: 1, limit: 2 });
  });
});
