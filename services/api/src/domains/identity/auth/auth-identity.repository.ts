import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';

type CreateRegistrationInput = {
  username: string;
  email: string;
  password: string;
  systemId: string;
  registrationStatus: 'PENDING' | 'PENDING_ACTIVATION';
  inviteCode?: string;
};

type ActivateRegistrationInput = {
  userId: string;
  registrationId: string;
  roleId: string;
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
}
