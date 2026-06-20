import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AmuxCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string) {
    return this.prisma.amux_credentials.findUnique({
      where: { userId },
      select: { host: true, oat: true, amuxUserId: true },
    });
  }

  upsert(
    userId: string,
    data: { host: string; oat: string; amuxUserId: number },
  ) {
    return this.prisma.amux_credentials.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  deleteByUserId(userId: string) {
    return this.prisma.amux_credentials.deleteMany({ where: { userId } });
  }
}
