import { StepUpRepository } from './step-up.repository';

function makeRepository(lockedSessions: Array<{ id: string }>) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue(lockedSessions),
    step_up_proofs: { create: jest.fn().mockResolvedValue({}) },
    email_otps: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'otp-1', expiresAt: new Date() }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { repository: new StepUpRepository(prisma as never), tx };
}

describe('StepUpRepository account/session lock', () => {
  const proofInput = {
    jti: 'jti-1',
    userId: 'u1',
    sessionId: 'session-1',
    purpose: 'STEP_UP_CHANGE_EMAIL' as const,
    kind: 'reauth-otp',
    expiresAt: new Date('2026-07-12T01:00:00Z'),
  };
  const otpInput = {
    userId: 'u1',
    sessionId: 'session-1',
    emailHash: 'hash',
    codeHash: 'code-hash',
    purpose: 'STEP_UP_CHANGE_EMAIL' as const,
    maxAttempts: 5,
    expiresAt: new Date('2026-07-12T01:00:00Z'),
  };

  it('does not create a proof after deletion or session revocation', async () => {
    const { repository, tx } = makeRepository([]);
    await expect(repository.createProof(proofInput)).resolves.toBe(false);
    expect(tx.step_up_proofs.create).not.toHaveBeenCalled();
  });

  it('creates a proof only while holding the user and session row locks', async () => {
    const { repository, tx } = makeRepository([{ id: 'session-1' }]);
    await expect(repository.createProof(proofInput)).resolves.toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.step_up_proofs.create).toHaveBeenCalledWith({ data: proofInput });
  });

  it('does not create an OTP after deletion or session revocation', async () => {
    const { repository, tx } = makeRepository([]);
    await expect(repository.createOtp(otpInput)).resolves.toBeNull();
    expect(tx.email_otps.updateMany).not.toHaveBeenCalled();
    expect(tx.email_otps.create).not.toHaveBeenCalled();
  });
});
