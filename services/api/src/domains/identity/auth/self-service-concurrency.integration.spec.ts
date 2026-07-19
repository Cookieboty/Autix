import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@autix/database';
import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';
import { AuthIdentityRepository } from './auth-identity.repository';
import { AuthSessionRepository } from './auth-session.repository';
import { StepUpRepository } from './step-up/step-up.repository';

const databaseUrl = process.env.SELF_SERVICE_INTEGRATION_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const PREFIX = 'self-service-it-';

describeDatabase('user self-service PostgreSQL concurrency', () => {
  let prisma: PrismaClient;
  let identity: AuthIdentityRepository;
  let sessions: AuthSessionRepository;
  let stepUp: StepUpRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl! }),
    });
    identity = new AuthIdentityRepository(prisma as never);
    sessions = new AuthSessionRepository(prisma as never);
    stepUp = new StepUpRepository(prisma as never);
  });

  afterEach(async () => {
    await prisma.storage_cleanup_tasks.deleteMany({
      where: { ownerUserId: { startsWith: PREFIX } },
    });
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createUser(name: string, withSession = true) {
    const id = `${PREFIX}${name}`;
    await prisma.user.create({
      data: {
        id,
        username: `${PREFIX}${name}`,
        email: `${name}@integration.local`,
        emailVerified: true,
        pendingEmail: `${name}-pending@integration.local`,
        password: await bcrypt.hash('Password123', 4),
        realName: 'Sensitive Name',
        nickname: 'Sensitive Nickname',
        description: 'Sensitive Description',
        avatar: `https://cdn.example.com/avatars/${id}/current.png`,
        avatarStorageKey: `avatars/${id}/current.png`,
        phone: '13800000000',
        signupIp: '203.0.113.8',
        signupDeviceId: 'device-sensitive',
        status: 'ACTIVE',
      },
    });
    const sessionId = `${id}-session`;
    if (withSession) {
      await prisma.userSession.create({
        data: {
          id: sessionId,
          userId: id,
          refreshToken: `${id}-refresh`,
          expiresAt: new Date(Date.now() + 3_600_000),
          isActive: true,
        },
      });
    }
    return { id, sessionId, username: `${PREFIX}${name}` };
  }

  async function lockThenDelete(userId: string, operation: () => Promise<unknown>) {
    const blocker = new Client({ connectionString: databaseUrl! });
    await blocker.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const pending = operation();
      await new Promise((resolve) => setTimeout(resolve, 50));
      await blocker.query('UPDATE users SET status = \'DELETED\', "deletedAt" = NOW() WHERE id = $1', [userId]);
      await blocker.query('DELETE FROM user_sessions WHERE "userId" = $1', [userId]);
      await blocker.query('COMMIT');
      return await pending;
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      await blocker.end();
    }
  }

  it('consumes one OTP exactly once under concurrent verification', async () => {
    const user = await createUser('otp');
    const requestId = `${user.id}-otp`;
    await prisma.email_otps.create({
      data: {
        id: requestId,
        userId: user.id,
        sessionId: user.sessionId,
        emailHash: 'integration-email-hash',
        codeHash: await bcrypt.hash('123456', 4),
        purpose: 'STEP_UP_DELETE_ACCOUNT',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    const input = {
      requestId,
      userId: user.id,
      sessionId: user.sessionId,
      purpose: 'STEP_UP_DELETE_ACCOUNT' as const,
      emailHash: 'integration-email-hash',
      code: '123456',
      now: new Date(),
    };
    const results = await Promise.all([
      stepUp.verifyAndConsumeOtp(input),
      stepUp.verifyAndConsumeOtp(input),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['consumed', 'ok']);
  });

  it('anonymizes once, removes credentials and leaves no account PII', async () => {
    const user = await createUser('delete');
    const proofJti = `${user.id}-proof`;
    await prisma.step_up_proofs.create({
      data: {
        jti: proofJti,
        userId: user.id,
        sessionId: user.sessionId,
        purpose: 'STEP_UP_DELETE_ACCOUNT',
        kind: 'reauth-otp',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });
    await prisma.userAccount.create({
      data: {
        userId: user.id,
        provider: 'github',
        providerAccountId: `${user.id}-provider`,
        accessToken: 'sensitive-token',
      },
    });
    await prisma.user_risk_profiles.create({
      data: {
        userId: user.id,
        topSignals: { ip: '203.0.113.8' },
        blockedReason: 'sensitive reason',
      },
    });
    await prisma.pending_uploads.create({
      data: {
        ownerUserId: user.id,
        storageKey: `avatars/${user.id}/pending.png`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    const input = {
      userId: user.id,
      sessionId: user.sessionId,
      proofJti,
      usernameConfirmation: user.username,
    };
    const outcomes = await Promise.allSettled([
      identity.anonymizeUserImmediately(input),
      identity.anonymizeUserImmediately(input),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);

    const deleted = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(deleted).toMatchObject({
      status: 'DELETED',
      emailVerified: false,
      pendingEmail: null,
      password: null,
      realName: null,
      nickname: null,
      description: null,
      avatar: null,
      avatarStorageKey: null,
      phone: null,
      signupIp: null,
      signupDeviceId: null,
      lastLoginAt: null,
    });
    expect(deleted.username).toMatch(/^deleted_/);
    expect(deleted.email).toMatch(/@deleted\.local$/);
    expect(await prisma.userSession.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.userAccount.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.email_otps.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.step_up_proofs.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.pending_uploads.count({ where: { ownerUserId: user.id } })).toBe(0);

    const risk = await prisma.user_risk_profiles.findUniqueOrThrow({ where: { userId: user.id } });
    expect(risk.topSignals).toBeNull();
    expect(risk.blockedReason).toBeNull();
    expect(await prisma.storage_cleanup_tasks.count({ where: { ownerUserId: user.id } })).toBe(2);
  });

  it('does not create a proof or login session after deletion wins the user lock', async () => {
    const proofUser = await createUser('proof-race');
    const proofCreated = await lockThenDelete(proofUser.id, () => stepUp.createProof({
      jti: `${proofUser.id}-late-proof`,
      userId: proofUser.id,
      sessionId: proofUser.sessionId,
      purpose: 'STEP_UP_DELETE_ACCOUNT',
      kind: 'reauth-oauth',
      expiresAt: new Date(Date.now() + 300_000),
    }));
    expect(proofCreated).toBe(false);

    const loginUser = await createUser('login-race', false);
    await expect(lockThenDelete(loginUser.id, () => sessions.create({
      userId: loginUser.id,
      refreshToken: `${loginUser.id}-late-refresh`,
      ip: '127.0.0.1',
      userAgent: 'integration-test',
      expiresAt: new Date(Date.now() + 3_600_000),
    }))).rejects.toMatchObject({ i18nKey: 'auth.account.unavailable' });
    expect(await prisma.userSession.count({ where: { userId: loginUser.id } })).toBe(0);
  });

  it('does not rotate a refresh token after deletion wins the user lock', async () => {
    const user = await createUser('refresh-race');
    await expect(lockThenDelete(user.id, () => sessions.rotateRefreshToken({
      sessionId: user.sessionId,
      refreshToken: `${user.id}-rotated`,
      expiresAt: new Date(Date.now() + 3_600_000),
    }))).rejects.toMatchObject({ i18nKey: 'auth.account.unavailable' });
    expect(await prisma.userSession.count({ where: { userId: user.id } })).toBe(0);
  });
});
