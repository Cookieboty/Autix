import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AdminBootstrapRepository } from './admin-bootstrap.repository';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly adminBootstrapRepository: AdminBootstrapRepository) {}

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

    const existing = await this.adminBootstrapRepository.findSuperAdmin();

    if (existing) {
      if (process.env.SUPER_ADMIN_RESET_PASSWORD === 'true') {
        await this.adminBootstrapRepository.updatePassword(
          existing.id,
          await bcrypt.hash(password, 12),
        );
        this.logger.log(`Super-admin "${existing.username}" password reset`);
      } else {
        this.logger.log(
          `Super-admin "${existing.username}" already exists, skipped`,
        );
      }
      return;
    }

    await this.adminBootstrapRepository.createSuperAdmin({
      username,
      email,
      password: await bcrypt.hash(password, 12),
    });

    this.logger.log(`Super-admin "${username}" created`);
  }
}
