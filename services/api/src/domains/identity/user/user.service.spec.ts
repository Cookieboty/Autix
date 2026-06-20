import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRegistrationStatusSyncService } from './user-registration-status-sync.service';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

const ADMIN_USER = {
  id: 'admin-1',
  isSuperAdmin: true,
  currentSystemId: 'sys-1',
} as any;

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    username: 'alice',
    email: 'a@b.com',
    status: 'PENDING',
    isSuperAdmin: false,
    password: 'hashed',
    roles: [{ role: { systemId: 'sys-1' } }],
    ...overrides,
  };
}

function createTx() {
  return {
    user: { update: jest.fn().mockResolvedValue({}) },
    systemRegistration: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    role: { findFirst: jest.fn().mockResolvedValue(null) },
    userRole: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

function createPrisma(
  tx: ReturnType<typeof createTx>,
  userOverrides: Record<string, unknown> = {},
) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(mockUser(userOverrides)),
    },
    userSession: { deleteMany: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  };
}

function buildService(prisma: ReturnType<typeof createPrisma>) {
  return new UserService(
    new UserRepository(prisma as never),
    new UserRegistrationStatusSyncService(),
  );
}

describe('UserService.updateStatus', () => {
  it('throws ForbiddenException when modifying self', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    await expect(
      service.updateStatus('admin-1', { status: 'ACTIVE' } as any, ADMIN_USER),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when user does not exist', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.user.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(
      service.updateStatus('u1', { status: 'ACTIVE' } as any, ADMIN_USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Enable (→ ACTIVE) ──────────────────────────────────────────

  it('approves PENDING registrations and assigns USER role', async () => {
    const tx = createTx();
    tx.systemRegistration.findMany.mockResolvedValue([
      { id: 'reg-1', userId: 'u1', systemId: 'sys-1', status: 'PENDING' },
    ]);
    tx.role.findFirst.mockResolvedValue({ id: 'role-user', code: 'USER' });
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'ACTIVE' } as any, ADMIN_USER);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { status: 'ACTIVE' },
    });
    expect(tx.systemRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', status: { in: ['PENDING', 'PENDING_ACTIVATION'] } },
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
    expect(tx.userRole.upsert).toHaveBeenCalledWith({
      where: { userId_roleId: { userId: 'u1', roleId: 'role-user' } },
      update: {},
      create: { userId: 'u1', roleId: 'role-user' },
    });
  });

  it('approves PENDING_ACTIVATION registrations and assigns USER role', async () => {
    const tx = createTx();
    tx.systemRegistration.findMany.mockResolvedValue([
      { id: 'reg-1', userId: 'u1', systemId: 'sys-1', status: 'PENDING_ACTIVATION' },
    ]);
    tx.role.findFirst.mockResolvedValue({ id: 'role-user', code: 'USER' });
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'ACTIVE' } as any, ADMIN_USER);

    expect(tx.systemRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', status: { in: ['PENDING', 'PENDING_ACTIVATION'] } },
      }),
    );
    expect(tx.userRole.upsert).toHaveBeenCalledTimes(1);
  });

  it('handles multiple registrations across different systems', async () => {
    const tx = createTx();
    tx.systemRegistration.findMany.mockResolvedValue([
      { id: 'reg-1', userId: 'u1', systemId: 'sys-1', status: 'PENDING' },
      { id: 'reg-2', userId: 'u1', systemId: 'sys-2', status: 'PENDING_ACTIVATION' },
    ]);
    tx.role.findFirst
      .mockResolvedValueOnce({ id: 'role-1', code: 'USER' })
      .mockResolvedValueOnce({ id: 'role-2', code: 'USER' });
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'ACTIVE' } as any, ADMIN_USER);

    expect(tx.role.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.role.findFirst).toHaveBeenCalledWith({ where: { systemId: 'sys-1', code: 'USER' } });
    expect(tx.role.findFirst).toHaveBeenCalledWith({ where: { systemId: 'sys-2', code: 'USER' } });
    expect(tx.userRole.upsert).toHaveBeenCalledTimes(2);
  });

  it('skips role assignment when USER role is missing for a system', async () => {
    const tx = createTx();
    tx.systemRegistration.findMany.mockResolvedValue([
      { id: 'reg-1', userId: 'u1', systemId: 'sys-1', status: 'PENDING' },
    ]);
    tx.role.findFirst.mockResolvedValue(null);
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'ACTIVE' } as any, ADMIN_USER);

    expect(tx.systemRegistration.updateMany).toHaveBeenCalled();
    expect(tx.userRole.upsert).not.toHaveBeenCalled();
  });

  it('does nothing for registrations when none are pending', async () => {
    const tx = createTx();
    tx.systemRegistration.findMany.mockResolvedValue([]);
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'ACTIVE' } as any, ADMIN_USER);

    expect(tx.user.update).toHaveBeenCalled();
    expect(tx.systemRegistration.updateMany).not.toHaveBeenCalled();
    expect(tx.userRole.upsert).not.toHaveBeenCalled();
  });

  it('does not revoke sessions when setting status to ACTIVE', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'ACTIVE' } as any, ADMIN_USER);

    expect(prisma.userSession.deleteMany).not.toHaveBeenCalled();
  });

  // ── Disable (→ DISABLED) ───────────────────────────────────────

  it('rejects PENDING registrations when disabling', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx, { status: 'ACTIVE' });
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'DISABLED' } as any, ADMIN_USER);

    expect(tx.systemRegistration.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: { in: ['PENDING', 'PENDING_ACTIVATION'] } },
      data: { status: 'REJECTED' },
    });
  });

  it('rejects PENDING_ACTIVATION registrations when disabling', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx, { status: 'ACTIVE' });
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'DISABLED' } as any, ADMIN_USER);

    expect(tx.systemRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', status: { in: ['PENDING', 'PENDING_ACTIVATION'] } },
      }),
    );
  });

  it('revokes all sessions when disabling', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx, { status: 'ACTIVE' });
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'DISABLED' } as any, ADMIN_USER);

    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });

  it('revokes all sessions when locking', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx, { status: 'ACTIVE' });
    const service = buildService(prisma);

    await service.updateStatus('u1', { status: 'LOCKED' } as any, ADMIN_USER);

    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });
});
