import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AuthUser, MessageResponse } from '@autix/domain';
import { isSupportedLang } from '@autix/i18n';
import { Prisma } from '../../platform/prisma/generated';
import * as bcrypt from 'bcryptjs';
import { UserRegistrationStatusSyncService } from './user-registration-status-sync.service';
import { UserRepository } from './user.repository';

interface UserListResult {
  data: Awaited<ReturnType<UserRepository['findUsers']>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface RoleSummary {
  id: string;
  name: string;
  code: string;
}

interface UserRolesBySystem {
  systemId: string;
  systemName: string;
  systemCode: string;
  roles: RoleSummary[];
}

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly registrationStatusSync: UserRegistrationStatusSyncService,
  ) { }

  async create(dto: CreateUserDto, currentUser: AuthUser) {
    const existingUser = await this.userRepository.findByUsernameOrEmail(
      dto.username,
      dto.email,
    );

    if (existingUser) {
      throw new I18nHttpException(HttpStatus.CONFLICT, 'user.username_or_email_taken');
    }

    // Determine target system and role
    let targetSystemId: string;
    let targetRoleCode: string;

    if (currentUser.isSuperAdmin && dto.systemId) {
      // Super admin explicitly specifies system and role
      targetSystemId = dto.systemId;
      targetRoleCode = dto.roleCode || 'USER';
    } else if (currentUser.currentSystemId) {
      // System admin — use their current system, always USER role
      targetSystemId = currentUser.currentSystemId;
      targetRoleCode = 'USER';
    } else {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'system.target_unknown');
    }

    // Find the target role
    const targetRole = await this.userRepository.findRoleBySystemAndCode(
      targetSystemId,
      targetRoleCode,
    );
    if (!targetRole) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'role.not_in_system', { roleCode: targetRoleCode });
    }

    const hashedPassword = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;

    const newUser = await this.userRepository.createWithRole({
      dto,
      password: hashedPassword,
      roleId: targetRole.id,
    });

    return newUser;
  }

  async findAll(query: QueryUserDto, currentUser: AuthUser): Promise<UserListResult> {
    const { username, email, page = 1, pageSize = 10, includeDeleted = false } = query;

    const where: Prisma.UserWhereInput = {
      status: includeDeleted && currentUser.isSuperAdmin ? undefined : { not: 'DELETED' },
    };

    // System-scoped filtering: non-super admins only see users in their current system
    if (!currentUser.isSuperAdmin && currentUser.currentSystemId) {
      where.roles = {
        some: {
          role: { systemId: currentUser.currentSystemId },
        },
      };
    }

    if (username) {
      where.username = { contains: username };
    }

    if (email) {
      where.email = { contains: email };
    }

    const [total, users] = await Promise.all([
      this.userRepository.count(where),
      this.userRepository.findUsers(where, page, pageSize),
    ]);

    return {
      data: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string, currentUser: AuthUser) {
    const user = await this.userRepository.findByIdWithPermissions(id);

    if (!user) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'user.not_found');
    }
    if (user.status === 'DELETED' && !currentUser.isSuperAdmin) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'user.not_found');
    }

    // System-scoped access check
    if (!currentUser.isSuperAdmin && currentUser.currentSystemId) {
      const hasSystemRole = user.roles.some(
        (ur) => ur.role.systemId === currentUser.currentSystemId,
      );
      if (!hasSystemRole) {
        throw new I18nHttpException(HttpStatus.FORBIDDEN, 'user.forbidden');
      }
    }

    const { password, ...result } = user;
    // spec §3.2 F：超管查看已注销用户时返回匿名化只读快照并标记 readonly:true，供前端隐藏编辑动作。
    if (user.status === 'DELETED') {
      return { ...result, readonly: true as const };
    }
    return result;
  }

  async update(id: string, dto: UpdateUserDto, currentUser: AuthUser) {
    const target = await this.findOne(id, currentUser);
    this.assertMutable(target.status);
    this.assertActorOutranksTarget(currentUser, target);

    const updateData: UpdateUserDto = {};
    if (Object.prototype.hasOwnProperty.call(dto, 'username')) updateData.username = dto.username;
    if (Object.prototype.hasOwnProperty.call(dto, 'email')) updateData.email = dto.email;
    if (Object.prototype.hasOwnProperty.call(dto, 'realName')) updateData.realName = dto.realName;
    if (Object.prototype.hasOwnProperty.call(dto, 'avatar')) updateData.avatar = dto.avatar;
    if (Object.prototype.hasOwnProperty.call(dto, 'phone')) updateData.phone = dto.phone;

    if (updateData.username || updateData.email) {
      const existingUser = await this.userRepository.findConflictForUpdate(id, updateData);

      if (existingUser) {
        throw new I18nHttpException(HttpStatus.CONFLICT, 'user.username_or_email_taken');
      }
    }

    return this.userRepository.update(id, updateData);
  }

  async remove(id: string, currentUser: AuthUser): Promise<MessageResponse> {
    const target = await this.findOne(id, currentUser);
    this.assertMutable(target.status);
    this.assertActorOutranksTarget(currentUser, target);

    if (id === currentUser.id) {
      throw new I18nHttpException(HttpStatus.FORBIDDEN, 'user.cannot_delete_self');
    }

    await this.userRepository.delete(id);
    return { message: '删除成功' };
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    currentUser: AuthUser,
  ): Promise<MessageResponse> {
    const target = await this.findOne(id, currentUser);
    this.assertMutable(target.status);
    this.assertActorOutranksTarget(currentUser, target);

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.userRepository.updatePasswordAndRevokeSessions(id, hashedPassword);

    return { message: '密码重置成功，用户需要重新登录' };
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    currentUser: AuthUser,
  ): Promise<MessageResponse> {
    const target = await this.findOne(id, currentUser);
    this.assertMutable(target.status);
    this.assertActorOutranksTarget(currentUser, target);

    if (id === currentUser.id) {
      throw new I18nHttpException(HttpStatus.FORBIDDEN, 'user.cannot_modify_own_status');
    }

    await this.userRepository.updateStatusAndSyncRegistration(id, dto.status, (tx) =>
      this.registrationStatusSync.sync(tx, id, dto.status),
    );

    // 如果禁用用户，撤销所有 session
    if (dto.status !== 'ACTIVE') {
      await this.userRepository.revokeSessions(id);
    }

    return { message: '状态更新成功' };
  }

  async assignRoles(
    userId: string,
    systemRoles: { systemId: string; roleIds: string[] }[],
    currentUser: AuthUser,
  ): Promise<MessageResponse> {
    const target = await this.findOne(userId, currentUser);
    this.assertMutable(target.status);
    this.assertActorOutranksTarget(currentUser, target);

    // 安全：非超管不得修改自己的角色（与 remove/updateStatus 的自我保护一致），防止自我提权。
    if (!currentUser.isSuperAdmin && userId === currentUser.id) {
      throw new I18nHttpException(HttpStatus.FORBIDDEN, 'user.cannot_modify_own_role');
    }

    // System admin can only assign roles in their current system
    if (!currentUser.isSuperAdmin && currentUser.currentSystemId) {
      const invalidSystem = systemRoles.find(
        (sr) => sr.systemId !== currentUser.currentSystemId,
      );
      if (invalidSystem) {
        throw new I18nHttpException(HttpStatus.FORBIDDEN, 'role.cross_system_forbidden');
      }
    }

    await this.userRepository.assignRoles(userId, systemRoles);

    return { message: '角色分配成功' };
  }

  async updateLanguage(userId: string, language: string): Promise<{ language: string }> {
    if (!isSupportedLang(language)) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'user.unsupported_language', { language });
    }
    await this.userRepository.updateLanguage(userId, language);
    return { language };
  }

  async updateAutoPublish(
    userId: string,
    autoPublish: boolean,
  ): Promise<{ autoPublish: boolean }> {
    await this.userRepository.updateAutoPublish(userId, autoPublish);
    return { autoPublish };
  }

  async getUserRolesBySystem(
    userId: string,
    currentUser: AuthUser,
  ): Promise<UserRolesBySystem[]> {
    await this.findOne(userId, currentUser);

    const userRoles = await this.userRepository.findRolesByUser(userId);

    const rolesBySystem = userRoles.reduce<Record<string, UserRolesBySystem>>((acc, ur) => {
      const systemId = ur.role.systemId;
      if (!acc[systemId]) {
        acc[systemId] = {
          systemId,
          systemName: ur.role.system.name,
          systemCode: ur.role.system.code,
          roles: [],
        };
      }
      acc[systemId].roles.push({
        id: ur.role.id,
        name: ur.role.name,
        code: ur.role.code,
      });
      return acc;
    }, {});

    return Object.values(rolesBySystem);
  }

  private assertMutable(status: string): void {
    if (status === 'DELETED') {
      throw new I18nHttpException(HttpStatus.CONFLICT, 'user.deleted_read_only', undefined, { code: 'USER_DELETED' });
    }
  }

  /**
   * 安全：非超级管理员不得对超级管理员目标执行改资料/改状态/重置密码/改角色/删除等操作。
   * 否则同系统内的普通管理员只要与超管共享一个系统角色，就能通过 reset-password 接管、或
   * disable 锁死更高权限账户（authz 之前仅判"同系统"，不比较权限层级）。
   */
  private assertActorOutranksTarget(
    currentUser: AuthUser,
    target: { isSuperAdmin?: boolean },
  ): void {
    if (!currentUser.isSuperAdmin && target.isSuperAdmin) {
      throw new I18nHttpException(HttpStatus.FORBIDDEN, 'user.higher_privilege_forbidden');
    }
  }
}
