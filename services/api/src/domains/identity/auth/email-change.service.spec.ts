import { EmailChangeService } from './email-change.service';

function deps(over: any = {}) {
  const identity = {
    findUserByEmail: jest.fn().mockResolvedValue(null),
    findUserById: jest.fn().mockResolvedValue({ id: 'u1', pendingEmail: 'a@x.com' }),
    setPendingEmail: jest.fn().mockResolvedValue(undefined),
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
});
