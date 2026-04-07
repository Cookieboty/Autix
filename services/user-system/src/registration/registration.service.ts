import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '@repo/types';
import { ProcessRegistrationDto } from './dto/process-registration.dto';

@Injectable()
export class RegistrationService {
  constructor(private prisma: PrismaService) {}

  private async assertSystemAdminAccess(user: AuthUser, systemId: string): Promise<void> {
    if (user.isSuperAdmin) return;
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: user.id,
        role: { systemId, code: 'SYSTEM_ADMIN' },
      },
    });
    if (!userRole) {
      throw new ForbiddenException('无权操作此系统的注册申请');
    }
  }

  async findAll(user: AuthUser, systemId?: string, status?: string): Promise<any> {
    let systemFilter: any;
    if (systemId) {
      await this.assertSystemAdminAccess(user, systemId);
      systemFilter = { systemId };
    } else if (!user.isSuperAdmin) {
      const adminRoles = await this.prisma.userRole.findMany({
        where: {
          userId: user.id,
          role: { code: 'SYSTEM_ADMIN' },
        },
        include: { role: true },
      });
      const systemIds = adminRoles.map((ur) => ur.role.systemId);
      systemFilter = { systemId: { in: systemIds } };
    }

    const where: any = { ...systemFilter };
    if (status) where.status = status;

    return this.prisma.systemRegistration.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, email: true, realName: true, createdAt: true },
        },
        system: { select: { id: true, name: true, code: true } },
        processedBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, user: AuthUser, dto: ProcessRegistrationDto) {
    const registration = await this.prisma.systemRegistration.findUnique({
      where: { id },
    });
    if (!registration) throw new NotFoundException('注册申请不存在');
    if (registration.status !== 'PENDING') {
      throw new BadRequestException('该申请已处理');
    }

    await this.assertSystemAdminAccess(user, registration.systemId);

    const userRole = await this.prisma.role.findFirst({
      where: { systemId: registration.systemId, code: 'USER' },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.systemRegistration.update({
        where: { id },
        data: {
          status: 'APPROVED',
          note: dto.note,
          processedAt: new Date(),
          processedById: user.id,
        },
      });

      await tx.user.update({
        where: { id: registration.userId },
        data: { status: 'ACTIVE' },
      });

      if (userRole) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: registration.userId, roleId: userRole.id } },
          update: {},
          create: { userId: registration.userId, roleId: userRole.id },
        });
      }
    });

    return { message: '审批通过' };
  }

  async reject(id: string, user: AuthUser, dto: ProcessRegistrationDto) {
    const registration = await this.prisma.systemRegistration.findUnique({
      where: { id },
    });
    if (!registration) throw new NotFoundException('注册申请不存在');
    if (registration.status !== 'PENDING') {
      throw new BadRequestException('该申请已处理');
    }

    await this.assertSystemAdminAccess(user, registration.systemId);

    await this.prisma.$transaction(async (tx) => {
      await tx.systemRegistration.update({
        where: { id },
        data: {
          status: 'REJECTED',
          note: dto.note,
          processedAt: new Date(),
          processedById: user.id,
        },
      });

      await tx.user.update({
        where: { id: registration.userId },
        data: { status: 'DISABLED' },
      });
    });

    return { message: '已拒绝' };
  }

  async getPendingCount(user: AuthUser): Promise<number> {
    if (user.isSuperAdmin) {
      return this.prisma.systemRegistration.count({ where: { status: 'PENDING' } });
    }
    const adminRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id, role: { code: 'SYSTEM_ADMIN' } },
      include: { role: true },
    });
    const systemIds = adminRoles.map((ur) => ur.role.systemId);
    return this.prisma.systemRegistration.count({
      where: { status: 'PENDING', systemId: { in: systemIds } },
    });
  }
}
