import { AuthSessionRepository } from './auth-session.repository';

function createPrisma() {
  return {
    userSession: {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'session-1' }),
      update: jest.fn().mockResolvedValue({ id: 'session-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'session-1' }),
    },
  } as any;
}

describe('AuthSessionRepository', () => {
  it('creates sessions with current system context', async () => {
    const prisma = createPrisma();
    const repository = new AuthSessionRepository(prisma);
    const expiresAt = new Date('2026-06-20T00:00:00.000Z');

    await repository.create({
      userId: 'user-1',
      refreshToken: 'refresh-token',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      expiresAt,
      currentSystemId: 'system-1',
    });

    expect(prisma.userSession.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        refreshToken: 'refresh-token',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt,
        currentSystemId: 'system-1',
      },
    });
  });

  it('loads refresh sessions with the user required for token payloads', async () => {
    const prisma = createPrisma();
    const repository = new AuthSessionRepository(prisma);

    await repository.findByRefreshToken('refresh-token');

    expect(prisma.userSession.findUnique).toHaveBeenCalledWith({
      where: { refreshToken: 'refresh-token' },
      include: { user: true },
    });
  });

  it('rotates refresh tokens by session id', async () => {
    const prisma = createPrisma();
    const repository = new AuthSessionRepository(prisma);
    const expiresAt = new Date('2026-06-20T00:00:00.000Z');

    await repository.rotateRefreshToken({
      sessionId: 'session-1',
      refreshToken: 'new-refresh-token',
      expiresAt,
    });

    expect(prisma.userSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        refreshToken: 'new-refresh-token',
        expiresAt,
      },
    });
  });

  it('deletes sessions by id', async () => {
    const prisma = createPrisma();
    const repository = new AuthSessionRepository(prisma);

    await repository.delete('session-1');

    expect(prisma.userSession.delete).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
  });
});
