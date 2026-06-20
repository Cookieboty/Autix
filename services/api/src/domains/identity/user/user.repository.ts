import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type TransactionClient = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0];

type CreateUserWithRoleInput = {
  dto: CreateUserDto;
  password?: string;
  roleId: string;
};

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUsernameOrEmail(username: string, email: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });
  }

  findRoleBySystemAndCode(systemId: string, code: string) {
    return this.prisma.role.findFirst({
      where: { systemId, code },
    });
  }

  createWithRole(input: CreateUserWithRoleInput) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.dto.username,
          email: input.dto.email,
          password: input.password,
          realName: input.dto.realName,
          phone: input.dto.phone,
          status: 'ACTIVE',
          isSuperAdmin: false,
        },
        select: {
          id: true,
          username: true,
          email: true,
          realName: true,
          phone: true,
          status: true,
          isSuperAdmin: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.userRole.create({
        data: { userId: created.id, roleId: input.roleId },
      });

      return created;
    });
  }

  count(where: Prisma.UserWhereInput) {
    return this.prisma.user.count({ where });
  }

  findUsers(where: Prisma.UserWhereInput, page: number, pageSize: number) {
    return this.prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        username: true,
        email: true,
        realName: true,
        avatar: true,
        phone: true,
        status: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                code: true,
                system: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdWithPermissions(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
  }

  findConflictForUpdate(
    id: string,
    updateData: Partial<Omit<CreateUserDto, 'password'>>,
  ) {
    return this.prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [
              updateData.username ? { username: updateData.username } : {},
              updateData.email ? { email: updateData.email } : {},
            ],
          },
        ],
      },
    });
  }

  updateAndSyncRegistration(
    id: string,
    dto: UpdateUserDto,
    syncRegistrationStatus: (tx: TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: dto,
        select: {
          id: true,
          username: true,
          email: true,
          realName: true,
          avatar: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await syncRegistrationStatus(tx);

      return user;
    });
  }

  delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  updatePassword(id: string, password: string) {
    return this.prisma.user.update({
      where: { id },
      data: { password },
    });
  }

  revokeSessions(id: string) {
    return this.prisma.userSession.deleteMany({ where: { userId: id } });
  }

  updateStatusAndSyncRegistration(
    id: string,
    status: UserStatus,
    syncRegistrationStatus: (tx: TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status },
      });

      await syncRegistrationStatus(tx);
    });
  }

  assignRoles(userId: string, systemRoles: { systemId: string; roleIds: string[] }[]) {
    return this.prisma.$transaction(async (tx) => {
      const systemIds = systemRoles.map((sr) => sr.systemId);

      await tx.userRole.deleteMany({
        where: {
          userId,
          role: {
            systemId: { in: systemIds },
          },
        },
      });

      const roleAssignments = systemRoles.flatMap((sr) =>
        sr.roleIds.map((roleId) => ({ userId, roleId })),
      );

      if (roleAssignments.length > 0) {
        await tx.userRole.createMany({
          data: roleAssignments,
        });
      }
    });
  }

  updateLanguage(userId: string, language: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { language },
    });
  }

  findRolesByUser(userId: string) {
    return this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { system: true },
        },
      },
    });
  }
}
