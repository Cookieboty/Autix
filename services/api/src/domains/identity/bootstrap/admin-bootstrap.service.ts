import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    const username = process.env.SUPER_ADMIN_USERNAME;
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!username || !email || !password) {
      this.logger.warn(
        'SUPER_ADMIN_USERNAME / SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not all set — skipping super-admin bootstrap',
      );
      return;
    }

    if (password.length < 12) {
      this.logger.warn(
        'SUPER_ADMIN_PASSWORD must be at least 12 characters — skipping super-admin bootstrap',
      );
      return;
    }

    const existing = await this.prisma.user.findFirst({
      where: { isSuperAdmin: true },
    });

    if (existing) {
      if (process.env.SUPER_ADMIN_RESET_PASSWORD === 'true') {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { password: await bcrypt.hash(password, 12) },
        });
        this.logger.log(`Super-admin "${existing.username}" password reset`);
      } else {
        this.logger.log(
          `Super-admin "${existing.username}" already exists, skipped`,
        );
      }
      return;
    }

    await this.prisma.user.create({
      data: {
        username,
        email,
        password: await bcrypt.hash(password, 12),
        status: 'ACTIVE',
        isSuperAdmin: true,
      },
    });

    this.logger.log(`Super-admin "${username}" created`);
  }
}
