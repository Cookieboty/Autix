import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AmuxCredentialService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    return this.prisma.amux_credentials.findUnique({
      where: { userId },
      select: { host: true, oat: true, amuxUserId: true },
    });
  }

  async upsert(userId: string, data: { host: string; oat: string; amuxUserId: number }) {
    return this.prisma.amux_credentials.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async delete(userId: string) {
    return this.prisma.amux_credentials.deleteMany({ where: { userId } });
  }
}
