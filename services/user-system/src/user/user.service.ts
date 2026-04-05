import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryUserDto } from './dto/query-user.dto';
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

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
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

  async findAll(query: QueryUserDto, currentUserId: string): Promise<any> {
    const { username, email, departmentId, page = 1, pageSize = 10 } = query;

    // 获取当前用户的部门信息
    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { departmentId: true, roles: { include: { role: true } } },
    });

    // 检查是否是超级管理员（可以看所有部门）
    const isSuperAdmin = currentUser?.roles.some((ur) => ur.role.code === 'SUPER_ADMIN');

    const where: any = {};

    // 部门数据过滤：非超级管理员只能看自己部门
    if (!isSuperAdmin && currentUser?.departmentId) {
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

  async findOne(id: string, currentUserId: string): Promise<any> {
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
    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { departmentId: true, roles: { include: { role: true } } },
    });

    const isSuperAdmin = currentUser?.roles.some((ur) => ur.role.code === 'SUPER_ADMIN');

    if (!isSuperAdmin && currentUser?.departmentId !== user.departmentId) {
      throw new ForbiddenException('无权访问其他部门的用户');
    }

    const { password, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdateUserDto, currentUserId: string): Promise<any> {
    await this.findOne(id, currentUserId); // 检查权限

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

  async remove(id: string, currentUserId: string) {
    await this.findOne(id, currentUserId); // 检查权限

    if (id === currentUserId) {
      throw new ForbiddenException('不能删除自己');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: '删除成功' };
  }

  async resetPassword(id: string, dto: ResetPasswordDto, currentUserId: string) {
    await this.findOne(id, currentUserId); // 检查权限

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    // 撤销该用户的所有 session
    await this.prisma.userSession.deleteMany({ where: { userId: id } });

    return { message: '密码重置成功，用户需要重新登录' };
  }

  async updateStatus(id: string, dto: UpdateStatusDto, currentUserId: string) {
    await this.findOne(id, currentUserId); // 检查权限

    if (id === currentUserId) {
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

  async assignRoles(userId: string, roleIds: string[], currentUserId: string) {
    await this.findOne(userId, currentUserId); // 检查权限

    // 删除现有角色
    await this.prisma.userRole.deleteMany({ where: { userId } });

    // 分配新角色
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId })),
    });

    return { message: '角色分配成功' };
  }
}
