import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  canTransitionUserStatus,
  type UserStatus as DomainUserStatus,
} from '@autix/domain';
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

  update(id: string, dto: UpdateUserDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockMutableForUpdate(tx, id);
      const updatesAvatar = Object.prototype.hasOwnProperty.call(dto, 'avatar');
      const user = await tx.user.update({
        where: { id },
        data: updatesAvatar ? { ...dto, avatarStorageKey: null } : dto,
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
      if (updatesAvatar && current.avatarStorageKey) {
        await tx.storage_cleanup_tasks.create({
          data: {
            storageKey: current.avatarStorageKey,
            ownerUserId: id,
            reason: 'ADMIN_AVATAR_REPLACED',
          },
        });
      }
      return user;
    });
  }

  delete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertMutableForUpdate(tx, id);
      return tx.user.delete({ where: { id } });
    });
  }

  updatePasswordAndRevokeSessions(id: string, password: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertMutableForUpdate(tx, id);
      await tx.user.update({ where: { id }, data: { password } });
      await tx.userSession.deleteMany({ where: { userId: id } });
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
      // 事务内锁定并读取当前状态：既拒绝 DELETED 终态（USER_DELETED），
      // 又通过 domain 白名单 canTransitionUserStatus 统一校验状态迁移（spec §3.2 D''）。
      const { status: currentStatus } = await this.lockMutableForUpdate(tx, id);
      if (!canTransitionUserStatus(currentStatus as DomainUserStatus, status as DomainUserStatus)) {
        throw new BadRequestException({
          code: 'INVALID_STATUS_TRANSITION',
          message: `不允许的状态迁移：${currentStatus} -> ${status}`,
        });
      }
      await tx.user.update({
        where: { id },
        data: { status },
      });

      await syncRegistrationStatus(tx);
    });
  }

  assignRoles(userId: string, systemRoles: { systemId: string; roleIds: string[] }[]) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertMutableForUpdate(tx, userId);
      const systemIds = systemRoles.map((sr) => sr.systemId);

      await tx.userRole.deleteMany({
        where: {
          userId,
          role: {
            systemId: { in: systemIds },
          },
        },
      });

      // 安全：校验每个 roleId 确实属于其声明的 systemId。上层 authz 仅校验了 envelope 的 systemId，
      // 若不在此二次核对 role↔system 归属，system-X 管理员可提交 `{ systemId: X, roleIds: [<system-Y 的角色>] }`
      // 把跨系统（跨租户）角色写给目标（包括自己）→ 越权拿到 Y 系统权限。
      const allRoleIds = systemRoles.flatMap((sr) => sr.roleIds);
      if (allRoleIds.length > 0) {
        const roles = await tx.role.findMany({
          where: { id: { in: allRoleIds } },
          select: { id: true, systemId: true },
        });
        const roleSystem = new Map(roles.map((r) => [r.id, r.systemId]));
        for (const sr of systemRoles) {
          for (const roleId of sr.roleIds) {
            if (roleSystem.get(roleId) !== sr.systemId) {
              throw new BadRequestException({
                code: 'BAD_REQUEST',
                message: '角色与系统不匹配',
              });
            }
          }
        }
      }

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
    return this.prisma.$transaction(async (tx) => {
      await this.assertMutableForUpdate(tx, userId);
      return tx.user.update({ where: { id: userId }, data: { language } });
    });
  }

  updateAutoPublish(userId: string, autoPublish: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertMutableForUpdate(tx, userId);
      return tx.user.update({ where: { id: userId }, data: { autoPublish } });
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

  private async lockMutableForUpdate(
    tx: TransactionClient,
    id: string,
  ): Promise<{ status: string; avatarStorageKey: string | null }> {
    const rows = await tx.$queryRaw<Array<{ status: string; avatarStorageKey: string | null }>>`
      SELECT "status", "avatarStorageKey" FROM "users" WHERE "id" = ${id} FOR UPDATE
    `;
    if (!rows[0] || rows[0].status === 'DELETED') {
      throw new ConflictException({ code: 'USER_DELETED', message: '已删除用户为只读记录' });
    }
    return rows[0];
  }

  private async assertMutableForUpdate(tx: TransactionClient, id: string): Promise<void> {
    await this.lockMutableForUpdate(tx, id);
  }
}
