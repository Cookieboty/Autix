import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AuthUser } from '@repo/types';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<any> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
      },
    });

    if (existingUser) {
      throw new ConflictException('用户名或邮箱已存在');
    }

    const hashedPassword = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    return this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        realName: dto.realName,
        avatar: dto.avatar,
        phone: dto.phone,
        departmentId: dto.departmentId,
        status: dto.status ?? 'ACTIVE',
        isSuperAdmin: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        realName: true,
        avatar: true,
        phone: true,
        status: true,
        isSuperAdmin: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(query: QueryUserDto, currentUser: AuthUser): Promise<any> {
    const { username, email, departmentId, page = 1, pageSize = 10 } = query;

    const where: any = {};

    // 部门数据过滤：非超级管理员只能看自己部门
    if (!currentUser.isSuperAdmin && currentUser.departmentId) {
      where.departmentId = currentUser.departmentId;
    }

    if (username) {
      where.username = { contains: username };
    }

    if (email) {
      where.email = { contains: email };
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
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
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string, currentUser: AuthUser): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
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

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 部门数据过滤检查
    if (!currentUser.isSuperAdmin && currentUser.departmentId !== user.departmentId) {
      throw new ForbiddenException('无权访问其他部门的用户');
    }

    const { password, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdateUserDto, currentUser: AuthUser): Promise<any> {
    await this.findOne(id, currentUser); // 检查权限

    const updateData = dto as Partial<Omit<CreateUserDto, 'password'>>;

    if (updateData.username || updateData.email) {
      const existingUser = await this.prisma.user.findFirst({
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

      if (existingUser) {
        throw new ConflictException('用户名或邮箱已存在');
      }
    }

    return this.prisma.user.update({
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
        departmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, currentUser: AuthUser) {
    await this.findOne(id, currentUser); // 检查权限

    if (id === currentUser.id) {
      throw new ForbiddenException('不能删除自己');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: '删除成功' };
  }

  async resetPassword(id: string, dto: ResetPasswordDto, currentUser: AuthUser) {
    await this.findOne(id, currentUser); // 检查权限

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    // 撤销该用户的所有 session
    await this.prisma.userSession.deleteMany({ where: { userId: id } });

    return { message: '密码重置成功，用户需要重新登录' };
  }

  async updateStatus(id: string, dto: UpdateStatusDto, currentUser: AuthUser) {
    await this.findOne(id, currentUser); // 检查权限

    if (id === currentUser.id) {
      throw new ForbiddenException('不能修改自己的状态');
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
    });

    // 如果禁用用户，撤销所有 session
    if (dto.status !== 'ACTIVE') {
      await this.prisma.userSession.deleteMany({ where: { userId: id } });
    }

    return { message: '状态更新成功' };
  }

  async assignRoles(userId: string, systemRoles: { systemId: string; roleIds: string[] }[], currentUser: AuthUser) {
    await this.findOne(userId, currentUser);

    await this.prisma.$transaction(async (tx) => {
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

    return { message: '角色分配成功' };
  }

  async getUserRolesBySystem(userId: string, currentUser: AuthUser): Promise<any> {
    await this.findOne(userId, currentUser);

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { system: true },
        },
      },
    });

    const rolesBySystem = userRoles.reduce((acc, ur) => {
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
    }, {} as Record<string, any>);

    return Object.values(rolesBySystem);
  }
}
