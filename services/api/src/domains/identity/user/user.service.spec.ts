import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    $queryRaw: vi.fn().mockResolvedValue([{ status: 'PENDING', avatarStorageKey: null }]),
    user: { update: vi.fn().mockResolvedValue({}) },
    userSession: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    storage_cleanup_tasks: { create: vi.fn().mockResolvedValue({}) },
    systemRegistration: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    role: { findFirst: vi.fn().mockResolvedValue(null) },
    userRole: { upsert: vi.fn().mockResolvedValue({}) },
  };
}

function createPrisma(
  tx: ReturnType<typeof createTx>,
  userOverrides: Record<string, unknown> = {},
) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(mockUser(userOverrides)),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    userSession: { deleteMany: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
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

  it('rejects every status transition out of DELETED', async () => {
    const tx = createTx();
    tx.$queryRaw.mockResolvedValue([{ status: 'DELETED' }]);
    const prisma = createPrisma(tx, { status: 'DELETED' });
    const service = buildService(prisma);

    await expect(
      service.updateStatus('u1', { status: 'ACTIVE' } as any, ADMIN_USER),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
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

describe('UserService DELETED visibility and update whitelist', () => {
  it('filters DELETED by default and ignores includeDeleted for non-super admins', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    const service = buildService(prisma);
    const admin = { ...ADMIN_USER, isSuperAdmin: false };

    await service.findAll({ includeDeleted: true } as any, admin);

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: { not: 'DELETED' } }),
    });
  });

  it('allows only super admin to explicitly include DELETED rows', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    await service.findAll({ includeDeleted: true } as any, ADMIN_USER);

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: undefined }),
    });
  });

  it('drops status and creation-only fields from internal update calls', async () => {
    const tx = createTx();
    tx.$queryRaw.mockResolvedValue([{ status: 'ACTIVE' }]);
    const prisma = createPrisma(tx, { status: 'ACTIVE' });
    const service = buildService(prisma);

    await service.update('u1', {
      username: 'updated',
      status: 'DELETED',
      systemId: 'other-system',
      roleCode: 'SUPER_ADMIN',
    } as any, ADMIN_USER);

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { username: 'updated' },
    }));
  });

  it('clears the internal avatar key and enqueues cleanup in the admin update transaction', async () => {
    const tx = createTx();
    tx.$queryRaw.mockResolvedValue([{
      status: 'ACTIVE',
      avatarStorageKey: 'avatars/u1/old.png',
    }]);
    const prisma = createPrisma(tx, { status: 'ACTIVE' });
    const service = buildService(prisma);

    await service.update('u1', { avatar: 'https://cdn.example.com/new.png' }, ADMIN_USER);

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: {
        avatar: 'https://cdn.example.com/new.png',
        avatarStorageKey: null,
      },
    }));
    expect(tx.storage_cleanup_tasks.create).toHaveBeenCalledWith({
      data: {
        storageKey: 'avatars/u1/old.png',
        ownerUserId: 'u1',
        reason: 'ADMIN_AVATAR_REPLACED',
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not touch avatar ownership or enqueue cleanup for other admin updates', async () => {
    const tx = createTx();
    tx.$queryRaw.mockResolvedValue([{
      status: 'ACTIVE',
      avatarStorageKey: 'avatars/u1/current.png',
    }]);
    const prisma = createPrisma(tx, { status: 'ACTIVE' });
    const service = buildService(prisma);

    await service.update('u1', { realName: 'Alice' }, ADMIN_USER);

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { realName: 'Alice' },
    }));
    expect(tx.storage_cleanup_tasks.create).not.toHaveBeenCalled();
  });
});

describe('UserService.updateAutoPublish', () => {
  it('writes autoPublish=true and returns the value', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    const result = await service.updateAutoPublish('u1', true);

    expect(result).toEqual({ autoPublish: true });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { autoPublish: true },
    });
  });

  it('writes autoPublish=false', async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    const service = buildService(prisma);

    const result = await service.updateAutoPublish('u1', false);

    expect(result).toEqual({ autoPublish: false });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { autoPublish: false },
    });
  });
});

describe('UserService.resetPassword', () => {
  it('hashes the validated password and revokes sessions in one repository transaction', async () => {
    const tx = createTx();
    tx.$queryRaw.mockResolvedValue([{ status: 'ACTIVE', avatarStorageKey: null }]);
    const prisma = createPrisma(tx, { status: 'ACTIVE' });
    const service = buildService(prisma);

    await service.resetPassword('u1', { newPassword: 'Password1' }, ADMIN_USER);

    const passwordUpdate = tx.user.update.mock.calls[0]?.[0];
    expect(passwordUpdate.where).toEqual({ id: 'u1' });
    expect(passwordUpdate.data.password).not.toBe('Password1');
    expect(passwordUpdate.data.password).toMatch(/^\$2[aby]\$/);
    expect(tx.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
