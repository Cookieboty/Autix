import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

export type SystemWithMenusAndPermissions = Prisma.SystemGetPayload<{
  include: {
    menus: {
      include: {
        permissions: true;
      };
    };
  };
}>;

@Injectable()
export class PermissionTreeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSystemsWithMenusAndPermissions() {
    return this.prisma.system.findMany({
      include: {
        menus: {
          include: {
            permissions: {
              orderBy: { action: 'asc' },
            },
          },
          orderBy: { sort: 'asc' },
        },
      },
      orderBy: { sort: 'asc' },
    });
  }

  findSystemWithMenusAndPermissions(systemId: string) {
    return this.prisma.system.findUnique({
      where: { id: systemId },
      include: {
        menus: {
          include: {
            permissions: {
              orderBy: { action: 'asc' },
            },
          },
          orderBy: { sort: 'asc' },
        },
      },
    });
  }
}
