import * as bcrypt from 'bcryptjs';
import { StepUpHttpException, StepUpService } from './step-up.service';

function createDeps() {
  const repository = {
    findUser: vi.fn().mockResolvedValue({
      id: 'u1',
      password: null,
      email: 'user@example.com',
      emailVerified: true,
      status: 'ACTIVE',
    }),
    createProof: vi.fn().mockResolvedValue(true),
    createOtp: vi.fn().mockResolvedValue({
      id: 'otp-1',
      expiresAt: new Date(Date.now() + 300_000),
    }),
    invalidateOtp: vi.fn().mockResolvedValue(undefined),
    verifyAndConsumeOtp: vi.fn().mockResolvedValue({ status: 'ok' }),
  };
  const jwt = {
    sign: vi.fn().mockReturnValue('SIGNED-PROOF'),
    verify: vi.fn(),
  };
  const mail = { sendStepUpOtp: vi.fn().mockResolvedValue(undefined) };
  const rateLimit = { consume: vi.fn().mockResolvedValue(undefined) };
  const emailHash = { hash: vi.fn().mockReturnValue('EMAIL-HASH') };
  const service = new StepUpService(
    repository as any,
    jwt as any,
    mail as any,
    rateLimit as any,
    emailHash as any,
  );
  return { service, repository, jwt, mail, rateLimit, emailHash };
}

function expectCode(error: unknown, code: string) {
  expect(error).toBeInstanceOf(StepUpHttpException);
  expect((error as StepUpHttpException).getResponse()).toMatchObject({ code });
}

// 不要写成 `promise.catch(cb)`：实现一旦不再抛错，回调不执行，测试零断言通过。
async function expectRejection(promise: Promise<unknown>, code: string, httpStatus?: number) {
  const error = await promise.then(
    (value) => { throw new Error(`expected rejection, resolved with ${JSON.stringify(value)}`); },
    (caught: unknown) => caught,
  );
  expectCode(error, code);
  if (httpStatus !== undefined) {
    expect((error as StepUpHttpException).getStatus()).toBe(httpStatus);
  }
}

describe('StepUpService', () => {
  describe('authorizeByPassword', () => {
    it('requires a session-bound request', async () => {
      const { service, repository } = createDeps();
      await expectRejection(
        service.authorizeByPassword('u1', 'change-password', 'secret'),
        'STEP_UP_INVALID_OR_EXPIRED',
      );
      expect(repository.findUser).not.toHaveBeenCalled();
    });

    it('rejects users without a password', async () => {
      const { service } = createDeps();
      await expectRejection(
        service.authorizeByPassword('u1', 'change-password', 'secret', 'session-1'),
        'STEP_UP_UNAVAILABLE',
        409,
      );
    });

    it('rejects an incorrect password with the unified error code', async () => {
      const { service, repository } = createDeps();
      repository.findUser.mockResolvedValueOnce({
        id: 'u1',
        password: await bcrypt.hash('correct', 4),
        email: 'user@example.com',
        emailVerified: true,
        status: 'ACTIVE',
      });
      await expectRejection(
        service.authorizeByPassword('u1', 'change-password', 'wrong', 'session-1'),
        'STEP_UP_INVALID_OR_EXPIRED',
      );
    });

    it('persists a session-bound one-time proof after successful verification', async () => {
      const { service, repository, jwt } = createDeps();
      repository.findUser.mockResolvedValueOnce({
        id: 'u1',
        password: await bcrypt.hash('correct', 4),
        email: 'user@example.com',
        emailVerified: true,
        status: 'ACTIVE',
      });

      const result = await service.authorizeByPassword(
        'u1',
        'change-password',
        'correct',
        'session-1',
      );

      expect(result.proof).toBe('SIGNED-PROOF');
      expect(repository.createProof).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'u1',
        sessionId: 'session-1',
        purpose: 'STEP_UP_CHANGE_PASSWORD',
        kind: 'reauth-password',
      }));
      expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({
        sub: 'u1',
        sid: 'session-1',
        purpose: 'change-password',
        kind: 'reauth-password',
      }), { expiresIn: 300 });
    });
  });

  describe('requestOtp', () => {
    it('rejects password users before consuming OTP rate-limit capacity', async () => {
      const { service, repository, rateLimit, mail } = createDeps();
      repository.findUser.mockResolvedValueOnce({
        id: 'u1',
        password: 'HASH',
        email: 'user@example.com',
        emailVerified: true,
        status: 'ACTIVE',
      });

      await expectRejection(
        service.requestOtp('u1', 'change-email', 'session-1'),
        'STEP_UP_REQUIRED',
        400,
      );
      expect(rateLimit.consume).not.toHaveBeenCalled();
      expect(mail.sendStepUpOtp).not.toHaveBeenCalled();
    });

    it('rejects an unverified or placeholder email', async () => {
      const { service, repository } = createDeps();
      repository.findUser.mockResolvedValueOnce({
        id: 'u1',
        password: null,
        email: 'github-1@no-email.oauth.local',
        emailVerified: true,
        status: 'ACTIVE',
      });
      await expectRejection(
        service.requestOtp('u1', 'change-email', 'session-1'),
        'STEP_UP_UNAVAILABLE',
      );
    });

    it('invalidates the OTP when email delivery fails', async () => {
      const { service, repository, mail } = createDeps();
      mail.sendStepUpOtp.mockRejectedValueOnce(new Error('mail unavailable'));

      await expectRejection(
        service.requestOtp('u1', 'change-email', 'session-1'),
        'STEP_UP_UNAVAILABLE',
        409,
      );
      expect(repository.invalidateOtp).toHaveBeenCalledWith('otp-1');
    });

    it('creates an OTP bound to user, session, purpose and email hash', async () => {
      const { service, repository, mail } = createDeps();
      const result = await service.requestOtp('u1', 'delete-account', 'session-1');

      expect(result).toMatchObject({ kind: 'otp', requestId: 'otp-1' });
      expect(repository.createOtp).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'u1',
        sessionId: 'session-1',
        purpose: 'STEP_UP_DELETE_ACCOUNT',
        emailHash: 'EMAIL-HASH',
      }));
      expect(mail.sendStepUpOtp).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringMatching(/^\d{6}$/),
        'delete-account',
        5,
        undefined,
      );
    });

    it('does not send an OTP when deletion or session revocation wins the row lock', async () => {
      const { service, repository, mail } = createDeps();
      repository.createOtp.mockResolvedValueOnce(null);

      await expectRejection(
        service.requestOtp('u1', 'delete-account', 'session-1'),
        'STEP_UP_INVALID_OR_EXPIRED',
      );
      expect(mail.sendStepUpOtp).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    // spec §3.2 D'：除"已消费"（幂等冲突 409）外，其余失败（错误/过期/锁定）统一返回
    // 400 STEP_UP_INVALID_OR_EXPIRED，不暴露剩余尝试次数或锁定状态。
    it.each([
      ['invalid', 'STEP_UP_INVALID_OR_EXPIRED', 400],
      ['expired', 'STEP_UP_INVALID_OR_EXPIRED', 400],
      ['consumed', 'OTP_ALREADY_CONSUMED', 409],
      ['locked', 'STEP_UP_INVALID_OR_EXPIRED', 400],
    ] as const)('maps repository status %s to %s / HTTP %s', async (status, code, httpStatus) => {
      const { service, repository } = createDeps();
      repository.verifyAndConsumeOtp.mockResolvedValueOnce({ status });

      await expectRejection(
        service.verifyOtp('u1', 'change-email', 'otp-1', '123456', 'session-1'),
        code,
        httpStatus,
      );
    });

    it('signs an OTP proof only after atomic OTP consumption succeeds', async () => {
      const { service, repository } = createDeps();
      const result = await service.verifyOtp(
        'u1',
        'change-email',
        'otp-1',
        '123456',
        'session-1',
      );

      expect(repository.verifyAndConsumeOtp).toHaveBeenCalledWith(expect.objectContaining({
        requestId: 'otp-1',
        userId: 'u1',
        sessionId: 'session-1',
        purpose: 'STEP_UP_CHANGE_EMAIL',
        emailHash: 'EMAIL-HASH',
        code: '123456',
      }));
      expect(repository.createProof).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'session-1',
        kind: 'reauth-otp',
      }));
      expect(result.proof).toBe('SIGNED-PROOF');
    });

    it('does not sign a proof when deletion or session revocation wins the row lock', async () => {
      const { service, repository, jwt } = createDeps();
      repository.createProof.mockResolvedValueOnce(false);

      await expectRejection(
        service.verifyOtp('u1', 'change-email', 'otp-1', '123456', 'session-1'),
        'STEP_UP_INVALID_OR_EXPIRED',
      );
      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });

  describe('verifyProof', () => {
    it.each([
      [{ sub: 'other', purpose: 'change-password', sid: 'session-1', jti: 'j1' }, 'u1', 'change-password', 'session-1'],
      [{ sub: 'u1', purpose: 'change-email', sid: 'session-1', jti: 'j1' }, 'u1', 'change-password', 'session-1'],
      [{ sub: 'u1', purpose: 'change-password', sid: 'other', jti: 'j1' }, 'u1', 'change-password', 'session-1'],
      [{ sub: 'u1', purpose: 'change-password', jti: 'j1' }, 'u1', 'change-password', 'session-1'],
    ] as const)('rejects mismatched proof claims', (payload, userId, purpose, sessionId) => {
      const { service, jwt } = createDeps();
      jwt.verify.mockReturnValueOnce(payload);
      try {
        service.verifyProof('TOKEN', userId, purpose, sessionId);
        throw new Error('expected verifyProof to throw');
      } catch (error) {
        expectCode(error, 'STEP_UP_INVALID_OR_EXPIRED');
      }
    });

    it('normalizes signature and expiry failures', () => {
      const { service, jwt } = createDeps();
      jwt.verify.mockImplementationOnce(() => { throw new Error('jwt expired'); });
      try {
        service.verifyProof('TOKEN', 'u1', 'change-password', 'session-1');
        throw new Error('expected verifyProof to throw');
      } catch (error) {
        expectCode(error, 'STEP_UP_INVALID_OR_EXPIRED');
      }
    });

    it('returns a fully matching proof payload', () => {
      const { service, jwt } = createDeps();
      const payload = {
        sub: 'u1',
        purpose: 'change-password' as const,
        kind: 'reauth-password' as const,
        sid: 'session-1',
        jti: 'j1',
      };
      jwt.verify.mockReturnValueOnce(payload);
      expect(service.verifyProof('TOKEN', 'u1', 'change-password', 'session-1')).toEqual(payload);
    });
  });
});
