import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class AdminBootstrapRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSuperAdmin() {
    return this.prisma.user.findFirst({
      where: { isSuperAdmin: true, status: { not: 'DELETED' } },
    });
  }

  updatePassword(userId: string, password: string) {
    return this.prisma.user.updateMany({
      where: { id: userId, status: { not: 'DELETED' } },
      data: { password },
    });
  }

  createSuperAdmin(input: {
    username: string;
    email: string;
    password: string;
  }) {
    return this.prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        password: input.password,
        status: 'ACTIVE',
        isSuperAdmin: true,
      },
    });
  }
}
