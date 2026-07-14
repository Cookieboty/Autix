import { BadRequestException } from '@nestjs/common';
import { AuthIdentityRepository } from './auth-identity.repository';

describe('AuthIdentityRepository.setPendingEmail', () => {
  it('uses a conditional write so deletion cannot be followed by a PII write-back', async () => {
    const prisma = {
      user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const repository = new AuthIdentityRepository(prisma as any);

    await repository.setPendingEmail('u1', 'new@example.com');

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', status: { not: 'DELETED' } },
      data: { pendingEmail: 'new@example.com' },
    });
  });

  it('reports account unavailable when the conditional write loses to deletion', async () => {
    const prisma = {
      user: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const repository = new AuthIdentityRepository(prisma as any);

    await expect(repository.setPendingEmail('u1', 'new@example.com'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies a verified email only when it is still the current pending request', async () => {
    const prisma = {
      user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const repository = new AuthIdentityRepository(prisma as any);

    await repository.applyVerifiedEmail('u1', 'new@example.com');

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'u1',
        pendingEmail: 'new@example.com',
        status: { not: 'DELETED' },
      },
      data: { email: 'new@example.com', emailVerified: true, pendingEmail: null },
    });
  });
});
