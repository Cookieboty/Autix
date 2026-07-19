import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, RegistrationStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

type ProcessRegistrationInput = {
  id: string;
  note?: string;
  processedById: string;
};

@Injectable()
export class RegistrationRepository {
  constructor(private readonly prisma: PrismaService) { }

  findSystemAdminRole(userId: string, systemId: string) {
    return this.prisma.userRole.findFirst({
      where: {
        userId,
        role: { systemId, code: 'SYSTEM_ADMIN' },
      },
    });
  }

  findSystemAdminRoles(userId: string) {
    return this.prisma.userRole.findMany({
      where: {
        userId,
        role: { code: 'SYSTEM_ADMIN' },
      },
      include: { role: true },
    });
  }

  findRegistrations(
    systemFilter: Prisma.SystemRegistrationWhereInput | undefined,
    status?: string,
  ) {
    const where: Prisma.SystemRegistrationWhereInput = { ...systemFilter };
    if (status) where.status = status as RegistrationStatus;

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

  findById(id: string) {
    return this.prisma.systemRegistration.findUnique({
      where: { id },
    });
  }

  findRoleBySystemAndCode(systemId: string, code: string) {
    return this.prisma.role.findFirst({
      where: { systemId, code },
    });
  }

  approveRegistration(input: ProcessRegistrationInput & { userId: string; roleId: string }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.systemRegistration.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          note: input.note,
          processedAt: new Date(),
          processedById: input.processedById,
        },
      });

      const activated = await tx.user.updateMany({
        where: { id: input.userId, status: { not: 'DELETED' } },
        data: { status: 'ACTIVE' },
      });
      if (activated.count !== 1) throw new I18nHttpException(
        HttpStatus.CONFLICT,
        'registration.user_deleted',
        undefined,
        { code: 'USER_DELETED' },
      );

      await tx.userRole.upsert({
        where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
        update: {},
        create: { userId: input.userId, roleId: input.roleId },
      });
    });
  }

  findApprovalEmailUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });
  }

  rejectRegistration(input: ProcessRegistrationInput & { userId: string }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.systemRegistration.update({
        where: { id: input.id },
        data: {
          status: 'REJECTED',
          note: input.note,
          processedAt: new Date(),
          processedById: input.processedById,
        },
      });

      const disabled = await tx.user.updateMany({
        where: { id: input.userId, status: { not: 'DELETED' } },
        data: { status: 'DISABLED' },
      });
      if (disabled.count !== 1) throw new I18nHttpException(
        HttpStatus.CONFLICT,
        'registration.user_deleted',
        undefined,
        { code: 'USER_DELETED' },
      );
    });
  }

  count(where: Prisma.SystemRegistrationWhereInput) {
    return this.prisma.systemRegistration.count({ where });
  }
}
