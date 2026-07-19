import { AuthIdentityRepository } from './auth-identity.repository';

function model(overrides: Record<string, unknown> = {}) {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    ...overrides,
  };
}

function createRepository(proofCount = 1) {
  let queryIndex = 0;
  const tx: any = {
    $queryRaw: vi.fn().mockImplementation(async () => {
      queryIndex += 1;
      return queryIndex === 1
        ? [{ id: 'u1', status: 'ACTIVE', isSuperAdmin: false, avatarStorageKey: 'avatars/u1/current.png', username: 'alice' }]
        : [];
    }),
    $executeRaw: vi.fn().mockResolvedValue(0),
    step_up_proofs: model({
      updateMany: vi.fn().mockResolvedValue({ count: proofCount }),
    }),
    pending_uploads: model({
      findMany: vi.fn().mockResolvedValue([
        { storageKey: 'avatars/u1/pending.png', storageBucket: null },
      ]),
    }),
    storage_cleanup_tasks: model(),
    resource_likes: model({
      findMany: vi.fn().mockResolvedValue([{ resourceType: 'SKILL', resourceId: 'r1' }]),
      count: vi.fn().mockResolvedValue(2),
    }),
    resource_favorites: model({
      findMany: vi.fn().mockResolvedValue([{ resourceType: 'AGENT', resourceId: 'r2' }]),
      count: vi.fn().mockResolvedValue(3),
    }),
    userRole: model(),
    userSession: model(),
    userAccount: model(),
    socialLoginState: model(),
    socialLoginCode: model(),
    oAuthAuthorizationCode: model(),
    email_otps: model(),
    systemRegistration: model(),
    video_project_shares: model(),
    resource_views: model(),
    resource_view_events: model(),
    resource_uv_days: model(),
    gallery_comments: model(),
    resource_metrics: model(),
    user: model(),
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: any) => unknown) => callback(tx)),
  };
  return { repository: new AuthIdentityRepository(prisma as any), tx };
}

describe('AuthIdentityRepository.anonymizeUserImmediately', () => {
  it('consumes the proof, writes cleanup outbox, scrubs PII payloads, locks counters and anonymizes User', async () => {
    const { repository, tx } = createRepository();

    const result = await repository.anonymizeUserImmediately({
      userId: 'u1',
      sessionId: 'session-1',
      proofJti: 'proof-jti',
      usernameConfirmation: 'alice',
    });

    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(tx.step_up_proofs.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        jti: 'proof-jti',
        userId: 'u1',
        sessionId: 'session-1',
        purpose: 'STEP_UP_DELETE_ACCOUNT',
        consumedAt: null,
      }),
    }));
    expect(tx.storage_cleanup_tasks.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ storageKey: 'avatars/u1/current.png', reason: 'ACCOUNT_DELETED' }),
        expect.objectContaining({ storageKey: 'avatars/u1/pending.png', reason: 'PENDING_UPLOAD_EXPIRED' }),
      ]),
    });
    // User row + one set-based resource lock（creator 锁随 creator_profiles 表下线一并移除）。
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    const rawSql = tx.$executeRaw.mock.calls
      .map(([query]: [{ strings?: readonly string[] } | TemplateStringsArray]) => {
        const strings = Array.isArray(query)
          ? query
          : (query as { strings?: readonly string[] }).strings;
        return Array.from(strings ?? []).join(' ');
      })
      .join('\n');
    expect(rawSql).toContain('UPDATE "user_risk_profiles"');
    expect(rawSql).toContain('UPDATE "user_risk_events"');
    expect(rawSql).toContain('UPDATE "orders"');
    expect(rawSql).toContain('UPDATE "payment_events"');
    expect(rawSql).toContain('stripePaymentIntentId');
    expect(rawSql).toContain("'{data,object,subscription}'");
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: expect.objectContaining({
        status: 'DELETED',
        password: null,
        nickname: null,
        avatar: null,
        signupIp: null,
        signupDeviceId: null,
      }),
    }));
  });

  it('does not mutate account data when the proof was already consumed', async () => {
    const { repository, tx } = createRepository(0);

    await expect(repository.anonymizeUserImmediately({
      userId: 'u1',
      sessionId: 'session-1',
      proofJti: 'used-proof',
      usernameConfirmation: 'alice',
    })).rejects.toMatchObject({
      i18nKey: 'auth.step_up.invalid_or_expired',
      code: 'STEP_UP_INVALID_OR_EXPIRED',
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.userSession.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a mismatched username confirmation before consuming the proof', async () => {
    const { repository, tx } = createRepository();

    await expect(repository.anonymizeUserImmediately({
      userId: 'u1',
      sessionId: 'session-1',
      proofJti: 'proof-jti',
      usernameConfirmation: 'mallory',
    })).rejects.toMatchObject({
      i18nKey: 'auth.account.delete_confirmation_mismatch',
      code: 'ACCOUNT_DELETE_CONFIRMATION_MISMATCH',
    });
    expect(tx.step_up_proofs.updateMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
