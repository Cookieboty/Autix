import { Injectable } from '@nestjs/common';
import { type Prisma } from '../../platform/prisma/generated';

type TransactionClient = Prisma.TransactionClient;

const PENDING_REGISTRATION_STATUSES = [
  'PENDING',
  'PENDING_ACTIVATION',
] as const;

@Injectable()
export class UserRegistrationStatusSyncService {
  async sync(
    tx: TransactionClient,
    userId: string,
    newStatus: string | undefined,
  ): Promise<void> {
    if (newStatus === 'ACTIVE') {
      await this.approvePendingRegistrations(tx, userId);
      return;
    }

    if (newStatus === 'DISABLED') {
      await tx.systemRegistration.updateMany({
        where: {
          userId,
          status: { in: [...PENDING_REGISTRATION_STATUSES] },
        },
        data: { status: 'REJECTED' },
      });
    }
  }

  private async approvePendingRegistrations(
    tx: TransactionClient,
    userId: string,
  ): Promise<void> {
    const pendingRegs = await tx.systemRegistration.findMany({
      where: {
        userId,
        status: { in: [...PENDING_REGISTRATION_STATUSES] },
      },
    });

    if (pendingRegs.length === 0) return;

    await tx.systemRegistration.updateMany({
      where: {
        userId,
        status: { in: [...PENDING_REGISTRATION_STATUSES] },
      },
      data: { status: 'APPROVED', processedAt: new Date() },
    });

    for (const reg of pendingRegs) {
      const userRole = await tx.role.findFirst({
        where: { systemId: reg.systemId, code: 'USER' },
      });
      if (!userRole) continue;

      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: userRole.id } },
        update: {},
        create: { userId, roleId: userRole.id },
      });
    }
  }
}
