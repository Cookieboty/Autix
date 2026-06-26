import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';

type CreateRegistrationInput = {
  username: string;
  email: string;
  password: string;
  systemId: string;
  registrationStatus: 'PENDING' | 'PENDING_ACTIVATION';
  inviteCode?: string;
  signupIp?: string;
  signupDeviceId?: string;
};

type ActivateRegistrationInput = {
  userId: string;
  registrationId: string;
  roleId: string;
  inviteCode?: string;
};

type CreateUserAccountInput = {
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: Date;
  scope?: string;
  tokenType?: string;
  metadata?: unknown;
};

type CreateOAuthUserInput = {
  username: string;
  email: string;
  avatar?: string;
  realName?: string;
  systemId: string;
  defaultRoleCode: string;
  account: Omit<CreateUserAccountInput, 'userId'>;
  signupIp?: string;
  signupDeviceId?: string;
  inviteCode?: string;
};

@Injectable()
export class AuthIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLoginUserByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: {
          include: {
            role: {
              include: { system: true },
            },
          },
        },
      },
    });
  }

  findActiveSystems() {
    return this.prisma.system.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sort: 'asc' },
    });
  }

  updateLastLoginAt(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  findUserByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findAuthUserById(userId: string, currentSystemId?: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
          ...(currentSystemId
            ? { where: { role: { systemId: currentSystemId } } }
            : {}),
        },
      },
    });
  }

  findMembershipByUserId(userId: string) {
    return this.prisma.user_memberships.findUnique({
      where: { userId },
    });
  }

  findPasswordResetUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true },
    });
  }

  findSystemByCode(code: string) {
    return this.prisma.system.findUnique({ where: { code } });
  }

  findSystemById(id: string) {
    return this.prisma.system.findUnique({ where: { id } });
  }

  createRegistration(input: CreateRegistrationInput) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          password: input.password,
          status: 'PENDING',
          signupIp: input.signupIp,
          signupDeviceId: input.signupDeviceId,
        },
      });

      await tx.systemRegistration.create({
        data: {
          userId: user.id,
          systemId: input.systemId,
          status: input.registrationStatus,
          inviteCode: input.inviteCode,
        },
      });

      return user;
    });
  }

  findPendingActivationRegistration(userId: string) {
    return this.prisma.systemRegistration.findFirst({
      where: { userId, status: 'PENDING_ACTIVATION' },
      include: { system: true },
    });
  }

  findRegistrationByUserAndSystem(userId: string, systemId: string) {
    return this.prisma.systemRegistration.findUnique({
      where: { userId_systemId: { userId, systemId } },
    });
  }

  findRoleBySystemAndCode(systemId: string, code: string) {
    return this.prisma.role.findFirst({
      where: { systemId, code },
    });
  }

  activateRegistration(input: ActivateRegistrationInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.userId },
        data: { status: 'ACTIVE' },
      });

      await tx.systemRegistration.update({
        where: { id: input.registrationId },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
          inviteCode: input.inviteCode,
        },
      });

      await tx.userRole.upsert({
        where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
        update: {},
        create: { userId: input.userId, roleId: input.roleId },
      });
    });
  }

  findUserRoleInSystem(userId: string, systemId: string) {
    return this.prisma.userRole.findFirst({
      where: {
        userId,
        role: { systemId },
      },
    });
  }

  updatePassword(userId: string, password: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password },
    });
  }

  findProfileUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: { system: true, menus: { include: { menu: true } } },
            },
          },
        },
      },
    });
  }

  findMenusBySystem(systemId?: string) {
    return this.prisma.menu.findMany({
      where: { systemId },
      orderBy: { sort: 'asc' },
    });
  }

  findPermissionsBySystem(systemId?: string) {
    return this.prisma.permission.findMany({
      where: { menu: { systemId } },
    });
  }

  findLoginUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: { include: { system: true } } } } },
    });
  }

  findUserAccount(provider: string, providerAccountId: string) {
    return this.prisma.userAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      select: { userId: true },
    });
  }

  createUserAccount(input: CreateUserAccountInput) {
    return this.prisma.userAccount
      .create({
        data: {
          userId: input.userId,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          idToken: input.idToken,
          expiresAt: input.expiresAt,
          scope: input.scope,
          tokenType: input.tokenType,
          metadata: (input.metadata ?? undefined) as any,
        },
      })
      .then(() => undefined);
  }

  findUserAccountsByUserId(userId: string) {
    return this.prisma.userAccount.findMany({ where: { userId }, select: { provider: true } });
  }

  async hasOtherCredential(userId: string, excludeProvider: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (user?.password) return true;
    const others = await this.prisma.userAccount.count({ where: { userId, provider: { not: excludeProvider } } });
    return others > 0;
  }

  deleteUserAccount(userId: string, provider: string): Promise<void> {
    return this.prisma.userAccount.deleteMany({ where: { userId, provider } }).then(() => undefined);
  }

  createOAuthUser(input: CreateOAuthUserInput) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          password: null,
          status: 'ACTIVE',
          avatar: input.avatar,
          realName: input.realName,
          signupIp: input.signupIp,
          signupDeviceId: input.signupDeviceId,
        },
      });
      await tx.systemRegistration.create({
        data: { userId: user.id, systemId: input.systemId, status: 'APPROVED', processedAt: new Date(), inviteCode: input.inviteCode },
      });
      const role = await tx.role.findFirst({ where: { systemId: input.systemId, code: input.defaultRoleCode } });
      if (!role) {
        // 与邮箱激活流程（auth.service.ts:210）一致：缺默认角色直接抛错并回滚事务，
        // 避免产出 ACTIVE 但无可访问系统的"孤儿"用户。
        throw new BadRequestException(`该系统未配置默认用户角色(${input.defaultRoleCode})，无法完成账号创建`);
      }
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      await tx.userAccount.create({
        data: {
          userId: user.id,
          provider: input.account.provider,
          providerAccountId: input.account.providerAccountId,
          accessToken: input.account.accessToken,
          refreshToken: input.account.refreshToken,
          idToken: input.account.idToken,
          expiresAt: input.account.expiresAt,
          scope: input.account.scope,
          tokenType: input.account.tokenType,
          metadata: (input.account.metadata ?? undefined) as any,
        },
      });
      return { id: user.id };
    });
  }
}
