import { AccountDeletionService } from './account-deletion.service';

function makeService() {
  const identity = {
    anonymizeUserImmediately: vi.fn().mockResolvedValue({ deletedAt: new Date('2026-07-12T00:00:00Z') }),
  };
  const stepUp = {
    verifyProof: vi.fn().mockReturnValue({ jti: 'proof-jti' }),
  };
  const rateLimit = { consume: vi.fn().mockResolvedValue(undefined) };
  return {
    service: new AccountDeletionService(identity as any, stepUp as any, rateLimit as any),
    identity,
    stepUp,
    rateLimit,
  };
}

describe('AccountDeletionService', () => {
  it('verifies the session-bound proof and immediately anonymizes the account', async () => {
    const { service, identity, stepUp } = makeService();
    const result = await service.deleteImmediately('u1', 'proof', 'session-1', 'alice');
    expect(stepUp.verifyProof).toHaveBeenCalledWith('proof', 'u1', 'delete-account', 'session-1');
    expect(identity.anonymizeUserImmediately).toHaveBeenCalledWith({
      userId: 'u1',
      sessionId: 'session-1',
      proofJti: 'proof-jti',
      usernameConfirmation: 'alice',
    });
    expect(result.deletedAt.toISOString()).toBe('2026-07-12T00:00:00.000Z');
  });

  it('rejects a missing proof or session before touching persistence', async () => {
    const { service, identity } = makeService();
    await expect(service.deleteImmediately('u1', '', 'session-1', 'alice'))
      .rejects.toMatchObject({ i18nKey: 'auth.step_up.proof_missing', code: 'STEP_UP_INVALID_OR_EXPIRED' });
    await expect(service.deleteImmediately('u1', 'proof', undefined, 'alice'))
      .rejects.toMatchObject({ i18nKey: 'auth.step_up.proof_missing', code: 'STEP_UP_INVALID_OR_EXPIRED' });
    await expect(service.deleteImmediately('u1', 'proof', 'session-1'))
      .rejects.toMatchObject({ i18nKey: 'auth.step_up.proof_missing', code: 'STEP_UP_INVALID_OR_EXPIRED' });
    expect(identity.anonymizeUserImmediately).not.toHaveBeenCalled();
  });

  it('does not anonymize when proof verification fails', async () => {
    const { service, identity, stepUp } = makeService();
    stepUp.verifyProof.mockImplementation(() => { throw new Error('invalid proof'); });
    await expect(service.deleteImmediately('u1', 'bad', 'session-1', 'alice')).rejects.toThrow('invalid proof');
    expect(identity.anonymizeUserImmediately).not.toHaveBeenCalled();
  });
});
