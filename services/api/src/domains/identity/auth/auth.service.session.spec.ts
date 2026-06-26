import { AuthService } from './auth.service';

function makeUser(over: Partial<any> = {}) {
  return {
    id: 'u1', username: 'alice', language: 'zh-CN', status: 'ACTIVE',
    isSuperAdmin: false,
    roles: [{ role: { system: { id: 's1', name: 'Sys', code: 'sys' } } }],
    ...over,
  };
}

function makeService() {
  const identity = {
    findActiveSystems: jest.fn(),
    updateLastLoginAt: jest.fn().mockResolvedValue(undefined),
  };
  const session = {
    create: jest.fn().mockResolvedValue({ id: 'sess1', refreshToken: 'rt1' }),
  };
  const tokenFactory = {
    createRefreshToken: jest.fn().mockReturnValue('rt1'),
    createRefreshExpiresAt: jest.fn().mockReturnValue(new Date('2099-01-01')),
    createTokenPair: jest.fn().mockReturnValue({ accessToken: 'at1', refreshToken: 'rt1', expiresIn: 3600 }),
  };
  const svc = new AuthService(
    {} as any, {} as any, {} as any,
    identity as any, session as any, tokenFactory as any,
  );
  return { svc, identity, session, tokenFactory };
}

describe('AuthService.issueSessionForUser', () => {
  it('创建会话并返回 { loginResult, sessionId }，loginResult 与密码登录同构', async () => {
    const { svc, session, identity } = makeService();
    const { loginResult, sessionId } = await svc.issueSessionForUser(makeUser(), { ip: '1.1.1.1', userAgent: 'UA' });

    expect(session.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', refreshToken: 'rt1', ip: '1.1.1.1', userAgent: 'UA', currentSystemId: 's1' }),
    );
    expect(identity.updateLastLoginAt).toHaveBeenCalledWith('u1');
    expect(sessionId).toBe('sess1');
    // loginResult 不含 sessionId（响应语义零变化）
    expect(loginResult).not.toHaveProperty('sessionId');
    expect(loginResult).toEqual({
      accessToken: 'at1', refreshToken: 'rt1', expiresIn: 3600,
      status: 'ACTIVE', language: 'zh-CN', currentSystemId: 's1',
      systems: [{ id: 's1', name: 'Sys', code: 'sys' }],
    });
  });

  it('DISABLED 用户抛出未授权', async () => {
    const { svc } = makeService();
    await expect(
      svc.issueSessionForUser(makeUser({ status: 'DISABLED' }), { ip: '', userAgent: '' }),
    ).rejects.toThrow('账户已被禁用');
  });
});
