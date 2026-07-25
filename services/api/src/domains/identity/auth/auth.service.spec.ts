import type { Mock } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { AuthIdentityRepository } from './auth-identity.repository';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthService } from './auth.service';
import { AuthTokenFactory } from './auth-token.factory';

function createMockPrisma(overrides: Record<string, any> = {}) {
  const prisma: any = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({
        id: 'user-new',
        username: 'newuser',
        email: 'new@example.com',
      }),
    },
    userSession: {
      create: vi.fn().mockResolvedValue({
        id: 'session-1',
        refreshToken: 'rt-mock',
        userId: 'user-1',
      }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    system: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    systemRegistration: {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    role: { findFirst: vi.fn().mockResolvedValue(null) },
    userRole: { findFirst: vi.fn().mockResolvedValue(null) },
    pending_uploads: {
      findFirst: vi.fn().mockResolvedValue({ id: 'pending-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    storage_cleanup_tasks: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{
      status: 'ACTIVE',
      password: 'somehash-lasthash',
      avatarStorageKey: null,
    }]),
    ...overrides,
  };
  prisma.$transaction = vi.fn((fn: any) => fn(prisma));
  return prisma;
}

function createMockJwtService() {
  return {
    sign: vi.fn().mockReturnValue('access-token-mock'),
    verify: vi.fn(),
  } as any;
}

function createMockMailService() {
  return {
    sendActivationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockInviteService() {
  return {
    recordInvitation: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockCampaignRewardService() {
  return {
    grantRegistrationBonus: vi.fn().mockResolvedValue(null),
  } as any;
}

// T16: 头像上传 reservation-then-consume 相关 mock
function createMockR2Service() {
  return {
    getPublicUrl: vi.fn().mockImplementation((key: string) => `https://cdn.example.com/${key}`),
    getObjectMetadata: vi.fn().mockResolvedValue({
      exists: true,
      contentLength: 1024,
      contentType: 'image/png',
    }),
    createPresignedUpload: vi.fn().mockResolvedValue({
      uploadUrl: 'https://r2.example.com/upload',
      publicUrl: 'https://cdn.example.com/x',
      key: 'avatars/user-1/x',
    }),
  } as any;
}

function createMockStorageCleanupService() {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
  } as any;
}

// T18: AvatarImageProcessor 默认走降级路径 —— 返回原 key + publicUrl，
// 使沿用旧断言的 T16 spec 继续绿（相当于处理失败但主链路仍走通）。
// 单独测试 T18 processed 路径的 case 应在自己的 case 里覆盖 mock 返回值。
function createMockAvatarImageProcessor() {
  return {
    processAndUpload: vi.fn(async (userId: string, originalKey: string) => ({
      storageKey: originalKey,
      publicUrl: `https://cdn.mock/${originalKey}`,
      processed: false,
    })),
  } as any;
}

function buildService(prismaOverrides: Record<string, any> = {}) {
  const prisma = createMockPrisma(prismaOverrides);
  const jwt = createMockJwtService();
  const mail = createMockMailService();
  const invite = createMockInviteService();
  const campaignRewards = createMockCampaignRewardService();
  const identityRepository = new AuthIdentityRepository(prisma);
  const sessionRepository = new AuthSessionRepository(prisma);
  const tokenFactory = new AuthTokenFactory(jwt);
  const r2 = createMockR2Service();
  const storageCleanup = createMockStorageCleanupService();
  const avatarImageProcessor = createMockAvatarImageProcessor();
  const service = new AuthService(
    jwt,
    mail,
    invite,
    campaignRewards,
    identityRepository,
    sessionRepository,
    tokenFactory,
    {} as any,
    r2,
    storageCleanup,
    avatarImageProcessor,
  );
  return { service, prisma, jwt, mail, invite, campaignRewards, identityRepository, sessionRepository, tokenFactory, r2, storageCleanup, avatarImageProcessor };
}

const VALID_USER = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  password: '$2a$12$LJ3/YB0GZWQ1FKeLz0L7eO8s8pLiZ5Y5z5u5u5u5u5u5u5u5u5u5',
  status: 'ACTIVE',
  isSuperAdmin: false,
  language: 'zh-CN',
  roles: [
    {
      role: {
        id: 'role-1',
        systemId: 'sys-1',
        system: { id: 'sys-1', name: 'Main', code: 'main', status: 'ACTIVE' },
      },
    },
  ],
};

describe('AuthService', () => {
  describe('login', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      const { service } = buildService();
      await expect(
        service.login({ username: 'nobody', password: 'pass' }, '127.0.0.1', 'agent'),
      ).rejects.toMatchObject({ i18nKey: 'auth.login.invalid_credentials' });
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue({
        ...VALID_USER,
        password: '$2a$12$invalidhash000000000000000000000000000000000000000000',
      });
      await expect(
        service.login({ username: 'testuser', password: 'wrongpass' }, '127.0.0.1', 'agent'),
      ).rejects.toMatchObject({ i18nKey: 'auth.login.invalid_credentials' });
    });

    it('should throw UnauthorizedException when user is DISABLED', async () => {
      const bcrypt = await import('bcryptjs');
      const hashed = await bcrypt.hash('correctpass', 4);
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue({
        ...VALID_USER,
        password: hashed,
        status: 'DISABLED',
      });
      await expect(
        service.login({ username: 'testuser', password: 'correctpass' }, '127.0.0.1', 'agent'),
      ).rejects.toMatchObject({ i18nKey: 'auth.account.disabled' });
    });

    it('should return tokens and session on successful login', async () => {
      const bcrypt = await import('bcryptjs');
      const hashed = await bcrypt.hash('correctpass', 4);
      const { service, prisma, jwt } = buildService();
      prisma.user.findUnique.mockResolvedValue({
        ...VALID_USER,
        password: hashed,
      });
      jwt.sign.mockReturnValue('jwt-access-token');

      const result = await service.login(
        { username: 'testuser', password: 'correctpass' },
        '127.0.0.1',
        'test-agent',
      );

      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.systems).toHaveLength(1);
      expect(result.systems[0].id).toBe('sys-1');
      expect(prisma.userSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });

    it('DELETED 用户不可登录', async () => {
      const bcrypt = await import('bcryptjs');
      const hashed = await bcrypt.hash('correctpass', 4);
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue({
        ...VALID_USER,
        password: hashed,
        status: 'DELETED',
      });
      await expect(
        service.login({ username: 'testuser', password: 'correctpass' }, '127.0.0.1', 'agent'),
      ).rejects.toMatchObject({ i18nKey: 'auth.account.unavailable' });
    });

    it('should allow login with email as identifier', async () => {
      const bcrypt = await import('bcryptjs');
      const hashed = await bcrypt.hash('correctpass', 4);
      const { service, prisma, jwt } = buildService();
      prisma.user.findUnique.mockImplementation(({ where }: any) => {
        if (where?.email === 'test@example.com') {
          return Promise.resolve({ ...VALID_USER, password: hashed });
        }
        return Promise.resolve(null);
      });
      jwt.sign.mockReturnValue('jwt-access-token');

      const result = await service.login(
        { username: 'Test@Example.com  ', password: 'correctpass' },
        '127.0.0.1',
        'test-agent',
      );

      expect(result.accessToken).toBe('jwt-access-token');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ email: 'test@example.com' }) }),
      );
    });

    it('should throw invalid_credentials when email not found', async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ username: 'ghost@example.com', password: 'whatever' }, '127.0.0.1', 'agent'),
      ).rejects.toMatchObject({ i18nKey: 'auth.login.invalid_credentials' });
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ email: 'ghost@example.com' }) }),
      );
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException when session not found', async () => {
      const { service } = buildService();
      await expect(
        service.refresh({ refreshToken: 'invalid-rt' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.refresh.token_invalid' });
    });

    it('should throw UnauthorizedException when session is expired', async () => {
      const { service, prisma } = buildService();
      prisma.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        refreshToken: 'old-rt',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
        user: VALID_USER,
      });
      await expect(
        service.refresh({ refreshToken: 'old-rt' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.refresh.token_invalid' });
    });

    it('should throw UnauthorizedException when session is inactive', async () => {
      const { service, prisma } = buildService();
      prisma.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        refreshToken: 'old-rt',
        isActive: false,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: VALID_USER,
      });
      await expect(
        service.refresh({ refreshToken: 'old-rt' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.refresh.token_invalid' });
    });

    it('should return new token pair on valid refresh', async () => {
      const { service, prisma, jwt } = buildService();
      prisma.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        refreshToken: 'valid-rt',
        isActive: true,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: VALID_USER,
      });
      jwt.sign.mockReturnValue('new-access-token');

      const result = await service.refresh({ refreshToken: 'valid-rt' });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(prisma.userSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            refreshToken: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('register', () => {
    it('should throw ConflictException when username exists', async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        service.register({
          username: 'taken',
          email: 'new@example.com',
          password: 'pass123',
          systemCode: 'main',
        }),
      ).rejects.toMatchObject({ i18nKey: 'auth.register.username_taken' });
    });

    it('should throw ConflictException when email exists', async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-email' });
      await expect(
        service.register({
          username: 'newuser',
          email: 'taken@example.com',
          password: 'pass123',
          systemCode: 'main',
        }),
      ).rejects.toMatchObject({ i18nKey: 'auth.register.email_taken' });
    });

    it('should throw BadRequestException when system not found', async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.system.findUnique.mockResolvedValue(null);
      await expect(
        service.register({
          username: 'newuser',
          email: 'new@example.com',
          password: 'pass123',
          systemCode: 'nonexistent',
        }),
      ).rejects.toMatchObject({ i18nKey: 'auth.system.not_found' });
    });

    it('should return requiresActivation=false when system has no autoApprove', async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.system.findUnique.mockResolvedValue({
        id: 'sys-1',
        code: 'main',
        autoApprove: false,
      });

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'pass123',
        systemCode: 'main',
      });

      expect(result.requiresActivation).toBe(false);
    });

    it('should record invitation immediately after registration succeeds', async () => {
      const { service, prisma, invite } = buildService();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.system.findUnique.mockResolvedValue({
        id: 'sys-1',
        code: 'main',
        autoApprove: false,
      });

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'pass123',
        systemCode: 'main',
        inviteCode: 'ABCD1234',
      });

      expect(result.requiresActivation).toBe(false);
      expect(invite.recordInvitation).toHaveBeenCalledWith('ABCD1234', 'user-new');
    });

    it('should return requiresActivation=true and send activation email for autoApprove system', async () => {
      const { service, prisma, mail } = buildService();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.system.findUnique.mockResolvedValue({
        id: 'sys-1',
        code: 'main',
        autoApprove: true,
      });
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const txPrisma = createMockPrisma();
        txPrisma.user.create.mockResolvedValue({
          id: 'new-user-id',
          email: 'new@example.com',
          username: 'newuser',
        });
        return fn(txPrisma);
      });

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'pass123',
        systemCode: 'main',
      });

      expect(result.requiresActivation).toBe(true);
      expect(mail.sendActivationEmail).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should delete the session', async () => {
      const { service, prisma } = buildService();
      await service.logout('session-1');
      expect(prisma.userSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });
  });

  describe('forgotPassword', () => {
    it('should return generic message even when user not found', async () => {
      const { service, mail } = buildService();
      const result = await service.forgotPassword({ email: 'nobody@example.com' });
      expect(result.messageKey).toBe('auth.password_reset.sent_if_exists');
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send reset email when user exists', async () => {
      const { service, prisma, mail } = buildService();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: '$2a$12$abcdefghijklmnopqrstuv',
      });
      const result = await service.forgotPassword({ email: 'test@example.com' });
      expect(result.messageKey).toBe('auth.password_reset.sent_if_exists');
      expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
        undefined,
      );
    });
  });

  describe('resetPasswordByToken', () => {
    it('should throw BadRequestException when token is invalid', async () => {
      const { service, jwt } = buildService();
      jwt.verify.mockImplementation(() => { throw new Error('expired'); });
      await expect(
        service.resetPasswordByToken({ token: 'bad-token', newPassword: 'new123' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.password_reset.link_invalid' });
    });

    it('should throw BadRequestException when purpose is not password-reset', async () => {
      const { service, jwt } = buildService();
      jwt.verify.mockReturnValue({ sub: 'user-1', purpose: 'other', ph: '12345678' });
      await expect(
        service.resetPasswordByToken({ token: 'token', newPassword: 'new123' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.password_reset.link_wrong_purpose' });
    });

    it('should reset password and clear sessions on valid token', async () => {
      const { service, prisma, jwt } = buildService();
      jwt.verify.mockReturnValue({ sub: 'user-1', purpose: 'password-reset', ph: 'lasthash' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: 'somehash-lasthash',
      });

      const result = await service.resetPasswordByToken({
        token: 'valid-token',
        newPassword: 'newpass123',
      });

      expect(result.messageKey).toBe('auth.password_reset.success');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ password: expect.any(String) }),
        }),
      );
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('updateOwnProfile (T11)', () => {
    const AUTH_USER = {
      id: 'user-1',
      sessionId: 'sess-1',
      username: 'u',
      email: 'e@x.com',
      isSuperAdmin: false,
      status: 'ACTIVE',
      permissions: [],
      roles: [],
    } as any;

    function setupSvc(dbUser: any = { id: 'user-1', status: 'ACTIVE', password: 'p', language: 'zh-CN', nickname: 'old' }) {
      const { service, identityRepository, sessionRepository, r2, storageCleanup, avatarImageProcessor } = buildService();
      // 让 updateOwnProfile 前置读到 ACTIVE
      vi.spyOn(identityRepository, 'findUserById').mockResolvedValue(dbUser as any);
      // 阻止真的写库
      vi.spyOn(identityRepository, 'updateOwnProfile').mockResolvedValue(undefined as any);
      // buildAuthProfile 依赖：findProfileUser + sessionRepository.findById + 各种系统查
      vi.spyOn(identityRepository, 'findProfileUser').mockResolvedValue({
        ...dbUser,
        nickname: 'new-nick',
        avatar: 'new-avatar',
        description: 'new-desc',
        emailVerified: true,
        pendingEmail: null,
        roles: [],
      } as any);
      vi.spyOn(identityRepository, 'findActiveSystems').mockResolvedValue([] as any);
      vi.spyOn(sessionRepository, 'findById').mockResolvedValue({ id: 'sess-1', currentSystemId: 's' } as any);
      return { service, identityRepository, r2, storageCleanup, avatarImageProcessor };
    }

    it('白名单三字段被转发给 repo（越权字段的最终拦截由 repo helper 保证）', async () => {
      const { service, identityRepository } = setupSvc();
      const spy = identityRepository.updateOwnProfile as Mock;
      await service.updateOwnProfile(AUTH_USER, {
        nickname: 'new-nick',
        description: 'new-desc',
        avatar: 'new-avatar',
      });
      expect(spy).toHaveBeenCalledTimes(1);
      const passed = spy.mock.calls[0][1];
      expect(passed).toEqual({
        nickname: 'new-nick',
        description: 'new-desc',
        avatar: 'new-avatar',
      });
    });

    it('DELETED 用户返回 UnauthorizedException', async () => {
      const { service } = setupSvc({ id: 'user-1', status: 'DELETED', password: 'p' });
      await expect(
        service.updateOwnProfile(AUTH_USER, { nickname: 'x' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.account.unavailable' });
    });

    it('DISABLED 用户返回 UnauthorizedException', async () => {
      const { service } = setupSvc({ id: 'user-1', status: 'DISABLED', password: 'p' });
      await expect(
        service.updateOwnProfile(AUTH_USER, { nickname: 'x' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.account.unavailable' });
    });

    it('LOCKED 用户返回 UnauthorizedException', async () => {
      const { service } = setupSvc({ id: 'user-1', status: 'LOCKED', password: 'p' });
      await expect(
        service.updateOwnProfile(AUTH_USER, { nickname: 'x' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.account.unavailable' });
    });

    it('账户不存在返回 UnauthorizedException', async () => {
      const { service, identityRepository } = setupSvc();
      (identityRepository.findUserById as Mock).mockResolvedValue(null);
      await expect(
        service.updateOwnProfile(AUTH_USER, { nickname: 'x' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.account.unavailable' });
    });

    it('返回值不含 avatarStorageKey', async () => {
      const { service } = setupSvc();
      const res = (await service.updateOwnProfile(AUTH_USER, { nickname: 'new-nick' })) as any;
      expect('avatarStorageKey' in res).toBe(false);
      // 且新值被 buildAuthProfile 覆盖（不是 JWT 快照）
      expect(res.nickname).toBe('new-nick');
    });

    it('DB 中已清空的 nullable profile 字段不会被旧请求快照回填', async () => {
      const { service, identityRepository } = setupSvc();
      (identityRepository.findProfileUser as Mock).mockResolvedValue({
        id: 'user-1',
        username: 'u',
        email: 'e@x.com',
        status: 'ACTIVE',
        password: 'p',
        nickname: null,
        description: null,
        avatar: null,
        realName: null,
        language: null,
        emailVerified: true,
        pendingEmail: null,
        roles: [],
      });

      const result = await service.buildAuthProfile({
        user: {
          ...AUTH_USER,
          nickname: 'stale nickname',
          description: 'stale description',
          avatar: 'https://stale.example/avatar.png',
        },
      });

      expect(result).toMatchObject({ nickname: null, description: null, avatar: null });
    });

    it('repo 层白名单：越权字段（email/isSuperAdmin/status）不进入 Prisma data；提供 avatar 时同步清空 avatarStorageKey (T16)', async () => {
      // 用真实 repository + mock prisma 覆盖 helper 白名单
      const { identityRepository, prisma } = buildService();
      await identityRepository.updateOwnProfile('user-1', {
        nickname: 'nn',
        description: 'dd',
        avatar: 'aa',
        // 攻击载荷：即便偷偷塞入 partial，repo 显式白名单会剥离
        email: 'attacker@x.com',
        isSuperAdmin: true,
        status: 'ACTIVE',
        avatarStorageKey: 'evil-key',
      } as any);
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      const call = (prisma.user.update as Mock).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'user-1' });
      // T16: avatar 写入时同步清空 avatarStorageKey，防止残留旧的内部 key
      expect(call.data).toEqual({ nickname: 'nn', description: 'dd', avatar: 'aa', avatarStorageKey: null });
      // 显式断言越权字段不存在
      expect('email' in call.data).toBe(false);
      expect('isSuperAdmin' in call.data).toBe(false);
      expect('status' in call.data).toBe(false);
      // avatarStorageKey 是 null（清空），而非攻击载荷 'evil-key'
      expect(call.data.avatarStorageKey).toBe(null);
    });

    it('repo 层白名单：不提供 avatar 时 avatarStorageKey 不进入 Prisma data (T16)', async () => {
      const { identityRepository, prisma } = buildService();
      await identityRepository.updateOwnProfile('user-1', { nickname: 'nn' });
      const call = (prisma.user.update as Mock).mock.calls[0][0];
      expect(call.data).toEqual({ nickname: 'nn' });
      expect('avatarStorageKey' in call.data).toBe(false);
    });

    it('repo 层外链头像更新与旧对象清理 outbox 同事务', async () => {
      const { identityRepository, prisma } = buildService();
      (prisma.$queryRaw as Mock).mockResolvedValueOnce([{
        status: 'ACTIVE',
        avatarStorageKey: 'avatars/user-1/old.png',
      }]);

      await identityRepository.updateOwnProfile('user-1', {
        avatar: 'https://external.example.com/new.png',
      });

      expect(prisma.storage_cleanup_tasks.create).toHaveBeenCalledWith({
        data: {
          storageKey: 'avatars/user-1/old.png',
          ownerUserId: 'user-1',
          reason: 'AVATAR_REPLACED',
        },
      });
    });

    it('repo 层锁定后发现 DELETED → BadRequestException', async () => {
      const { identityRepository, prisma } = buildService();
      (prisma.$queryRaw as Mock).mockResolvedValueOnce([{ status: 'DELETED', avatarStorageKey: null }]);
      await expect(
        identityRepository.updateOwnProfile('user-1', { nickname: 'x' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.account.unavailable' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────────────────────────
    // T16: 头像 reservation-then-consume 4 条 spec
    // ─────────────────────────────────────────────────────────────────────

    /**
     * 覆盖 avatarStorageKey 路径：
     * - T18: avatarImageProcessor.processAndUpload 被调用（先于 consume）
     * - identityRepository.consumeAvatarReservation 被调用（原子消费，携带 finalStorageKey）
     * - 事务返回旧 storageKey ≠ 新 key → storageCleanup.enqueue AVATAR_REPLACED
     */
    it('T16/T18: avatarStorageKey 路径 —— processor 处理 + 事务消费 reservation + enqueue AVATAR_REPLACED（processor 降级路径）', async () => {
      const { service, identityRepository, r2, avatarImageProcessor, storageCleanup } = setupSvc();
      vi.spyOn(identityRepository, 'assertPendingUploadReservation').mockResolvedValue({ sizeBytes: 1024, contentType: 'image/png' });
      const consumeSpy = vi
        .spyOn(identityRepository, 'consumeAvatarReservation')
        .mockResolvedValue({ oldStorageKey: 'avatars/user-1/old.png' });

      await service.updateOwnProfile(AUTH_USER, { avatarStorageKey: 'avatars/user-1/new.png' });

      // T18: processor 先被调（降级路径：默认 mock 返回原 key + processed=false）
      expect(r2.getObjectMetadata).toHaveBeenCalledWith('avatars/user-1/new.png');
      expect(avatarImageProcessor.processAndUpload).toHaveBeenCalledWith('user-1', 'avatars/user-1/new.png');
      expect(consumeSpy).toHaveBeenCalledTimes(1);
      // T18: consumeAvatarReservation 接受 4 参数（含 finalStorageKey）；降级时 final=original
      expect(consumeSpy).toHaveBeenCalledWith('user-1', 'avatars/user-1/new.png', expect.any(String), 'avatars/user-1/new.png');
      // 成功路径的清理任务由 consumeAvatarReservation 在同一事务写入 outbox。
      expect(storageCleanup.enqueue).not.toHaveBeenCalled();
    });

    it('拒绝不存在或元数据不匹配的 R2 对象，且不消费 reservation', async () => {
      const { service, identityRepository, r2, avatarImageProcessor } = setupSvc();
      vi.spyOn(identityRepository, 'assertPendingUploadReservation').mockResolvedValue({
        sizeBytes: 1024,
        contentType: 'image/png',
      });
      (r2.getObjectMetadata as Mock).mockResolvedValueOnce({
        exists: false,
        contentLength: null,
        contentType: null,
      });
      const consumeSpy = vi.spyOn(identityRepository, 'consumeAvatarReservation');

      await expect(
        service.updateOwnProfile(AUTH_USER, { avatarStorageKey: 'avatars/user-1/missing.png' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.profile.avatar_upload_mismatch' });

      (r2.getObjectMetadata as Mock).mockResolvedValueOnce({
        exists: true,
        contentLength: 1000,
        contentType: 'image/jpeg',
      });
      await expect(
        service.updateOwnProfile(AUTH_USER, { avatarStorageKey: 'avatars/user-1/mismatch.png' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.profile.avatar_upload_mismatch' });

      expect(avatarImageProcessor.processAndUpload).not.toHaveBeenCalled();
      expect(consumeSpy).not.toHaveBeenCalled();
    });

    /**
     * T18: processor 成功路径 —— consume 用 finalStorageKey（processed key），
     * 事务后额外 enqueue AVATAR_ORIGINAL_REPLACED 清理原图。
     */
    it('T18: processor processed=true 路径 —— consume 用 processedKey + enqueue AVATAR_ORIGINAL_REPLACED', async () => {
      const { service, identityRepository, avatarImageProcessor, storageCleanup } = setupSvc();
      vi.spyOn(identityRepository, 'assertPendingUploadReservation').mockResolvedValue({ sizeBytes: 1024, contentType: 'image/png' });
      (avatarImageProcessor.processAndUpload as Mock).mockResolvedValue({
        storageKey: 'avatars/user-1/processed.webp',
        publicUrl: 'https://cdn.mock/avatars/user-1/processed.webp',
        processed: true,
      });
      const consumeSpy = vi
        .spyOn(identityRepository, 'consumeAvatarReservation')
        .mockResolvedValue({ oldStorageKey: null });

      await service.updateOwnProfile(AUTH_USER, { avatarStorageKey: 'avatars/user-1/original.png' });

      // consume 用 processedKey 作为 finalStorageKey，reservationKey 仍是 original
      expect(consumeSpy).toHaveBeenCalledWith(
        'user-1',
        'avatars/user-1/original.png',
        'https://cdn.mock/avatars/user-1/processed.webp',
        'avatars/user-1/processed.webp',
      );
      expect(storageCleanup.enqueue).not.toHaveBeenCalled();
    });

    it('T18: reservation 并发失效时清理未引用的预处理派生对象', async () => {
      const { service, identityRepository, avatarImageProcessor, storageCleanup } = setupSvc();
      vi.spyOn(identityRepository, 'assertPendingUploadReservation').mockResolvedValue({ sizeBytes: 1024, contentType: 'image/png' });
      (avatarImageProcessor.processAndUpload as Mock).mockResolvedValue({
        storageKey: 'avatars/user-1/processed.webp',
        publicUrl: 'https://cdn.mock/avatars/user-1/processed.webp',
        processed: true,
      });
      vi.spyOn(identityRepository, 'consumeAvatarReservation')
        .mockRejectedValue(new I18nHttpException(HttpStatus.BAD_REQUEST, 'auth.profile.avatar_reservation_invalid'));

      await expect(
        service.updateOwnProfile(AUTH_USER, { avatarStorageKey: 'avatars/user-1/original.png' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.profile.avatar_reservation_invalid' });
      expect(storageCleanup.enqueue).toHaveBeenCalledWith({
        storageKey: 'avatars/user-1/processed.webp',
        ownerUserId: 'user-1',
        reason: 'AVATAR_REPLACED',
      });
    });

    /**
     * 幂等：consume 返回的 oldStorageKey 与新 key 相同（重复消费不应 enqueue AVATAR_REPLACED）。
     * 这也覆盖了首次上传（无旧 key）的分支：oldStorageKey=null 时不 enqueue。
     */
    it('T16: 幂等 —— oldStorageKey 与新 key 相同 / 为 null 时不 enqueue AVATAR_REPLACED', async () => {
      const { service, identityRepository, storageCleanup } = setupSvc();
      vi.spyOn(identityRepository, 'assertPendingUploadReservation').mockResolvedValue({ sizeBytes: 1024, contentType: 'image/png' });
      vi
        .spyOn(identityRepository, 'consumeAvatarReservation')
        .mockResolvedValueOnce({ oldStorageKey: 'avatars/user-1/same.png' })
        .mockResolvedValueOnce({ oldStorageKey: null });

      await service.updateOwnProfile(AUTH_USER, { avatarStorageKey: 'avatars/user-1/same.png' });
      expect(storageCleanup.enqueue).not.toHaveBeenCalled();

      (storageCleanup.enqueue as Mock).mockClear();
      await service.updateOwnProfile(AUTH_USER, { avatarStorageKey: 'avatars/user-1/first.png' });
      expect(storageCleanup.enqueue).not.toHaveBeenCalled();
    });

    /**
     * 越权：consumeAvatarReservation 内部 updateMany 匹配 ownerUserId=userId，
     * 攻击者用他人 reservation 的 storageKey 时 count=0 → BadRequestException。
     * 这里 mock consumeAvatarReservation 抛错，验证 service 原样冒泡（不吞异常、不 enqueue）。
     */
    it('T16: 越权 —— 使用他人 reservation 时 BadRequestException 冒泡，不触发 cleanup', async () => {
      const { service, identityRepository, storageCleanup } = setupSvc();
      vi.spyOn(identityRepository, 'assertPendingUploadReservation').mockResolvedValue({ sizeBytes: 1024, contentType: 'image/png' });
      vi
        .spyOn(identityRepository, 'consumeAvatarReservation')
        .mockRejectedValue(new I18nHttpException(HttpStatus.BAD_REQUEST, 'auth.profile.avatar_reservation_invalid'));

      await expect(
        service.updateOwnProfile(AUTH_USER, { avatarStorageKey: 'avatars/other-user/x.png' }),
      ).rejects.toMatchObject({ i18nKey: 'auth.profile.avatar_reservation_invalid' });
      expect(storageCleanup.enqueue).not.toHaveBeenCalled();
    });

    /**
     * 外链 avatar 路径：dbUser 已有 avatarStorageKey 时，切换到外链后 enqueue AVATAR_REPLACED
     * 删旧内部 key；同时 repo 层 helper 会同步清空 avatarStorageKey 列（由上面 repo 层 spec 覆盖）。
     */
    it('T16: 外链 avatar 路径交给 repository 原子更新并写清理 outbox', async () => {
      const dbUser = {
        id: 'user-1',
        status: 'ACTIVE',
        password: 'p',
        language: 'zh-CN',
        nickname: 'old',
        avatarStorageKey: 'avatars/user-1/legacy.png',
      };
      const { service, identityRepository, storageCleanup } = setupSvc(dbUser);

      await service.updateOwnProfile(AUTH_USER, { avatar: 'https://external.example.com/pic.png' });

      expect(identityRepository.updateOwnProfile).toHaveBeenCalledWith('user-1', {
        avatar: 'https://external.example.com/pic.png',
      });
      expect(storageCleanup.enqueue).not.toHaveBeenCalled();
    });

    /**
     * DTO 层已互斥，service 层 defence-in-depth：同时提交 avatar + avatarStorageKey → BadRequestException。
     */
    it('T16: avatar 与 avatarStorageKey 同时提交 —— defence-in-depth 抛 BadRequestException', async () => {
      const { service } = setupSvc();
      await expect(
        service.updateOwnProfile(AUTH_USER, {
          avatar: 'https://x.com/y.png',
          avatarStorageKey: 'avatars/user-1/z.png',
        }),
      ).rejects.toMatchObject({ i18nKey: 'auth.profile.avatar_conflict' });
    });
  });
});
