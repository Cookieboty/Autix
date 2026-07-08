import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { AuthIdentityRepository } from './auth-identity.repository';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthService } from './auth.service';
import { AuthTokenFactory } from './auth-token.factory';

function createMockPrisma(overrides: Record<string, any> = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({
        id: 'user-new',
        username: 'newuser',
        email: 'new@example.com',
      }),
    },
    userSession: {
      create: jest.fn().mockResolvedValue({
        id: 'session-1',
        refreshToken: 'rt-mock',
        userId: 'user-1',
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    system: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    systemRegistration: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    role: { findFirst: jest.fn().mockResolvedValue(null) },
    userRole: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((fn: any) => fn(createMockPrisma(overrides))),
    ...overrides,
  } as any;
}

function createMockJwtService() {
  return {
    sign: jest.fn().mockReturnValue('access-token-mock'),
    verify: jest.fn(),
  } as any;
}

function createMockMailService() {
  return {
    sendActivationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockInviteService() {
  return {
    recordInvitation: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockCampaignRewardService() {
  return {
    grantRegistrationBonus: jest.fn().mockResolvedValue(null),
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
  const service = new AuthService(
    jwt,
    mail,
    invite,
    campaignRewards,
    identityRepository,
    sessionRepository,
    tokenFactory,
  );
  return { service, prisma, jwt, mail, invite, campaignRewards, identityRepository, sessionRepository, tokenFactory };
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
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue({
        ...VALID_USER,
        password: '$2a$12$invalidhash000000000000000000000000000000000000000000',
      });
      await expect(
        service.login({ username: 'testuser', password: 'wrongpass' }, '127.0.0.1', 'agent'),
      ).rejects.toThrow(UnauthorizedException);
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
      ).rejects.toThrow(UnauthorizedException);
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
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException when session not found', async () => {
      const { service } = buildService();
      await expect(
        service.refresh({ refreshToken: 'invalid-rt' }),
      ).rejects.toThrow(UnauthorizedException);
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
      ).rejects.toThrow(UnauthorizedException);
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
      ).rejects.toThrow(UnauthorizedException);
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
      ).rejects.toThrow(ConflictException);
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
      ).rejects.toThrow(ConflictException);
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
      ).rejects.toThrow(BadRequestException);
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
      expect(result.message).toContain('如果邮箱存在');
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send reset email when user exists', async () => {
      const { service, prisma, mail } = buildService();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: '$2a$12$abcdefghijklmnopqrstuv',
      });
      const result = await service.forgotPassword({ email: 'test@example.com' });
      expect(result.message).toContain('如果邮箱存在');
      expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });
  });

  describe('resetPasswordByToken', () => {
    it('should throw BadRequestException when token is invalid', async () => {
      const { service, jwt } = buildService();
      jwt.verify.mockImplementation(() => { throw new Error('expired'); });
      await expect(
        service.resetPasswordByToken({ token: 'bad-token', newPassword: 'new123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when purpose is not password-reset', async () => {
      const { service, jwt } = buildService();
      jwt.verify.mockReturnValue({ sub: 'user-1', purpose: 'other', ph: '12345678' });
      await expect(
        service.resetPasswordByToken({ token: 'token', newPassword: 'new123' }),
      ).rejects.toThrow(BadRequestException);
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

      expect(result.message).toContain('密码重置成功');
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
});
