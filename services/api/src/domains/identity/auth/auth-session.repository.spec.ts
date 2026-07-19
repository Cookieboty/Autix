import { AuthSessionRepository } from './auth-session.repository';

function createRepository(status = 'ACTIVE') {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ status }]),
    userSession: {
      create: vi.fn().mockResolvedValue({ id: 'session-1', refreshToken: 'refresh-1' }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { repository: new AuthSessionRepository(prisma as any), tx, prisma };
}

describe('AuthSessionRepository.create', () => {
  it('creates the session and updates lastLoginAt under the same user row lock', async () => {
    const { repository, tx, prisma } = createRepository();

    await repository.create({
      userId: 'u1',
      refreshToken: 'refresh-1',
      ip: '127.0.0.1',
      userAgent: 'test',
      expiresAt: new Date('2099-01-01T00:00:00Z'),
      currentSystemId: 'system-1',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.userSession.create).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it('does not write session or lastLoginAt when deletion won the row lock', async () => {
    const { repository, tx } = createRepository('DELETED');

    await expect(repository.create({
      userId: 'u1',
      refreshToken: 'refresh-1',
      ip: '',
      userAgent: '',
      expiresAt: new Date('2099-01-01T00:00:00Z'),
    })).rejects.toMatchObject({ i18nKey: 'auth.account.unavailable' });
    expect(tx.userSession.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
