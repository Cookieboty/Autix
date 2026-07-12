import { EmailChangeService } from './email-change.service';

function deps(over: any = {}) {
  const identity = {
    findUserByEmail: jest.fn().mockResolvedValue(null),
    findUserById: jest.fn().mockResolvedValue({ id: 'u1', pendingEmail: 'a@x.com' }),
    setPendingEmail: jest.fn().mockResolvedValue(undefined),
    setPendingEmailWithProof: jest.fn().mockResolvedValue(undefined),
    applyVerifiedEmail: jest.fn().mockResolvedValue(undefined),
    ...over.identity,
  };
  const mail = { sendEmailVerification: jest.fn().mockResolvedValue(undefined) };
  const jwt = { sign: jest.fn().mockReturnValue('TKN'), verify: jest.fn().mockReturnValue({ sub: 'u1', email: 'a@x.com', purpose: 'email-verify' }) };
  const svc = new EmailChangeService(identity as any, mail as any, jwt as any);
  return { svc, identity, mail, jwt };
}

describe('EmailChangeService', () => {
  it('request 校验邮箱未被他人占用 → 存 pending + 发信', async () => {
    const { svc, identity, mail } = deps();
    await svc.request('u1', 'a@x.com');
    expect(identity.setPendingEmail).toHaveBeenCalledWith('u1', 'a@x.com');
    expect(mail.sendEmailVerification).toHaveBeenCalledWith('a@x.com', 'TKN');
  });
  it('request 邮箱被他人占用 → 冲突', async () => {
    const { svc } = deps({ identity: { findUserByEmail: jest.fn().mockResolvedValue({ id: 'other' }) } });
    await expect(svc.request('u1', 'a@x.com')).rejects.toThrow('该邮箱已被使用');
  });
  it('confirm 有效 token → 落地邮箱', async () => {
    const { svc, identity } = deps();
    await svc.confirm('TKN');
    expect(identity.applyVerifiedEmail).toHaveBeenCalledWith('u1', 'a@x.com');
  });
  it('confirm 错误 purpose → 抛错', async () => {
    const { svc, jwt } = deps();
    jwt.verify.mockReturnValueOnce({ sub: 'u1', email: 'a@x.com', purpose: 'login' });
    await expect(svc.confirm('TKN')).rejects.toThrow('无效');
  });
  it('confirm token 邮箱与 pendingEmail 不符 → 抛错（replay/superseded）', async () => {
    const { svc } = deps({
      identity: {
        findUserById: jest.fn().mockResolvedValue({ id: 'u1', pendingEmail: 'new@x.com' }),
      },
    });
    // token claims 'a@x.com' but pendingEmail is now 'new@x.com'
    await expect(svc.confirm('TKN')).rejects.toThrow('验证链接已过期或无效');
  });
  it('confirm 用户不存在 → 抛错', async () => {
    const { svc } = deps({
      identity: {
        findUserById: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(svc.confirm('TKN')).rejects.toThrow('验证链接已过期或无效');
  });

  // ---------- T5.1 分拆：requestSupplement / requestChange 双分支断言 ----------
  describe('requestSupplement (legacy /auth/email)', () => {
    it('user.email 为空 → 存 pending + 发信', async () => {
      const { svc, identity, mail } = deps({
        identity: {
          findUserById: jest.fn().mockResolvedValue({ id: 'u1', email: null, pendingEmail: null }),
        },
      });
      await svc.requestSupplement('u1', 'new@x.com');
      expect(identity.setPendingEmail).toHaveBeenCalledWith('u1', 'new@x.com');
      expect(mail.sendEmailVerification).toHaveBeenCalledWith('new@x.com', 'TKN');
    });

    it('user.email 已存在 → 拒绝，引导走 change', async () => {
      const { svc } = deps({
        identity: {
          findUserById: jest.fn().mockResolvedValue({ id: 'u1', email: 'old@x.com', pendingEmail: null }),
        },
      });
      await expect(svc.requestSupplement('u1', 'new@x.com')).rejects.toThrow('账户已绑定邮箱');
    });

    it('账户 DELETED → 拒绝', async () => {
      const { svc } = deps({
        identity: {
          findUserById: jest.fn().mockResolvedValue({ id: 'u1', status: 'DELETED', email: null }),
        },
      });
      await expect(svc.requestSupplement('u1', 'new@x.com')).rejects.toThrow('账户不可用');
    });

    it('通过 request(userId, email) 无 proof → 路由到 supplement', async () => {
      const { svc, identity } = deps({
        identity: {
          findUserById: jest.fn().mockResolvedValue({ id: 'u1', email: null }),
        },
      });
      await svc.request('u1', 'new@x.com');
      expect(identity.setPendingEmail).toHaveBeenCalledWith('u1', 'new@x.com');
    });
  });

  describe('requestChange (/auth/email/change)', () => {
    it('缺少 proof → 拒绝', async () => {
      const { svc } = deps();
      await expect(svc.requestChange('u1', 'new@x.com', '')).rejects.toThrow('缺少 step-up 凭证');
    });

    it('携带 proof 且 verifyProof 通过 → 存 pending + 发信', async () => {
      const stepUp = { verifyProof: jest.fn().mockReturnValue({ jti: 'proof-jti' }) } as any;
      const identity = {
        findUserByEmail: jest.fn().mockResolvedValue(null),
        findUserById: jest.fn().mockResolvedValue({ id: 'u1', email: 'old@x.com' }),
        setPendingEmail: jest.fn().mockResolvedValue(undefined),
        setPendingEmailWithProof: jest.fn().mockResolvedValue(undefined),
        applyVerifiedEmail: jest.fn(),
      } as any;
      const mail = { sendEmailVerification: jest.fn() } as any;
      const jwt = { sign: jest.fn().mockReturnValue('TKN2'), verify: jest.fn() } as any;
      const svc = new EmailChangeService(identity, mail, jwt, stepUp);
      await svc.requestChange('u1', 'new@x.com', 'PROOF', 'session-1');
      expect(stepUp.verifyProof).toHaveBeenCalledWith('PROOF', 'u1', 'change-email', 'session-1');
      expect(identity.setPendingEmailWithProof).toHaveBeenCalledWith({
        userId: 'u1',
        sessionId: 'session-1',
        proofJti: 'proof-jti',
        email: 'new@x.com',
      });
      expect(mail.sendEmailVerification).toHaveBeenCalledWith('new@x.com', 'TKN2');
    });

    it('verifyProof 抛错 → 冒泡', async () => {
      const stepUp = { verifyProof: jest.fn(() => { throw new Error('STEP_UP_INVALID_OR_EXPIRED'); }) } as any;
      const identity = {
        findUserByEmail: jest.fn(),
        findUserById: jest.fn(),
        setPendingEmail: jest.fn(),
        setPendingEmailWithProof: jest.fn(),
        applyVerifiedEmail: jest.fn(),
      } as any;
      const mail = { sendEmailVerification: jest.fn() } as any;
      const jwt = { sign: jest.fn(), verify: jest.fn() } as any;
      const svc = new EmailChangeService(identity, mail, jwt, stepUp);
      await expect(svc.requestChange('u1', 'new@x.com', 'BAD', 'session-1')).rejects.toThrow('STEP_UP_INVALID_OR_EXPIRED');
      expect(identity.setPendingEmailWithProof).not.toHaveBeenCalled();
    });

    it('通过 request(userId, email, proof) 带 proof → 路由到 change', async () => {
      const stepUp = { verifyProof: jest.fn().mockReturnValue({ jti: 'proof-jti' }) } as any;
      const identity = {
        findUserByEmail: jest.fn().mockResolvedValue(null),
        findUserById: jest.fn().mockResolvedValue({ id: 'u1', email: 'old@x.com' }),
        setPendingEmail: jest.fn(),
        setPendingEmailWithProof: jest.fn(),
        applyVerifiedEmail: jest.fn(),
      } as any;
      const mail = { sendEmailVerification: jest.fn() } as any;
      const jwt = { sign: jest.fn().mockReturnValue('TKN3'), verify: jest.fn() } as any;
      const svc = new EmailChangeService(identity, mail, jwt, stepUp);
      await svc.request('u1', 'new@x.com', 'PROOF', 'session-1');
      expect(stepUp.verifyProof).toHaveBeenCalledWith('PROOF', 'u1', 'change-email', 'session-1');
    });
  });
});
