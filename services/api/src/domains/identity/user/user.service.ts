import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AuthUser, MessageResponse } from '@autix/types';
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
  ) {}

  async create(dto: CreateUserDto, currentUser: AuthUser) {
    const existingUser = await this.userRepository.findByUsernameOrEmail(
      dto.username,
      dto.email,
    );

    if (existingUser) {
      throw new ConflictException('用户名或邮箱已存在');
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
      throw new BadRequestException('无法确定目标系统');
    }

    // Find the target role
    const targetRole = await this.userRepository.findRoleBySystemAndCode(
      targetSystemId,
      targetRoleCode,
    );
    if (!targetRole) {
      throw new BadRequestException(`系统中不存在角色: ${targetRoleCode}`);
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
    const { username, email, page = 1, pageSize = 10 } = query;

    const where: Prisma.UserWhereInput = {};

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
      throw new NotFoundException('用户不存在');
    }

    // System-scoped access check
    if (!currentUser.isSuperAdmin && currentUser.currentSystemId) {
      const hasSystemRole = user.roles.some(
        (ur) => ur.role.systemId === currentUser.currentSystemId,
      );
      if (!hasSystemRole) {
        throw new ForbiddenException('无权访问该用户');
      }
    }

    const { password, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdateUserDto, currentUser: AuthUser) {
    await this.findOne(id, currentUser); // 检查权限

    const updateData = dto as Partial<Omit<CreateUserDto, 'password'>>;

    if (updateData.username || updateData.email) {
      const existingUser = await this.userRepository.findConflictForUpdate(id, updateData);

      if (existingUser) {
        throw new ConflictException('用户名或邮箱已存在');
      }
    }

    return this.userRepository.updateAndSyncRegistration(id, dto, (tx) =>
      this.registrationStatusSync.sync(tx, id, dto.status),
    );
  }

  async remove(id: string, currentUser: AuthUser): Promise<MessageResponse> {
    await this.findOne(id, currentUser); // 检查权限

    if (id === currentUser.id) {
      throw new ForbiddenException('不能删除自己');
    }

    await this.userRepository.delete(id);
    return { message: '删除成功' };
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    currentUser: AuthUser,
  ): Promise<MessageResponse> {
    await this.findOne(id, currentUser); // 检查权限

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.userRepository.updatePassword(id, hashedPassword);

    // 撤销该用户的所有 session
    await this.userRepository.revokeSessions(id);

    return { message: '密码重置成功，用户需要重新登录' };
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    currentUser: AuthUser,
  ): Promise<MessageResponse> {
    await this.findOne(id, currentUser); // 检查权限

    if (id === currentUser.id) {
      throw new ForbiddenException('不能修改自己的状态');
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
    await this.findOne(userId, currentUser);

    // System admin can only assign roles in their current system
    if (!currentUser.isSuperAdmin && currentUser.currentSystemId) {
      const invalidSystem = systemRoles.find(
        (sr) => sr.systemId !== currentUser.currentSystemId,
      );
      if (invalidSystem) {
        throw new ForbiddenException('无权分配其他系统的角色');
      }
    }

    await this.userRepository.assignRoles(userId, systemRoles);

    return { message: '角色分配成功' };
  }

  async updateLanguage(userId: string, language: string): Promise<{ language: string }> {
    if (!isSupportedLang(language)) {
      throw new BadRequestException(`Unsupported language: ${language}`);
    }
    await this.userRepository.updateLanguage(userId, language);
    return { language };
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
}
