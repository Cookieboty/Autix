import { AuthIdentityRepository } from './auth-identity.repository';

function txMock() {
  return {
    user: { create: vi.fn().mockResolvedValue({ id: 'newU' }) },
    systemRegistration: { create: vi.fn().mockResolvedValue({}) },
    role: { findFirst: vi.fn().mockResolvedValue({ id: 'roleU' }) },
    userRole: { create: vi.fn().mockResolvedValue({}) },
    userAccount: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe('AuthIdentityRepository OAuth methods', () => {
  it('findUserAccount 命中返回 userId', async () => {
    const prisma = { userAccount: { findUnique: vi.fn().mockResolvedValue({ userId: 'u9' }) } };
    const repo = new AuthIdentityRepository(prisma as any);
    const r = await repo.findUserAccount('google', 'sub-1');
    expect(prisma.userAccount.findUnique).toHaveBeenCalledWith({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: 'sub-1' } },
      select: { userId: true },
    });
    expect(r).toEqual({ userId: 'u9' });
  });

  it('createOAuthUser 在事务内建 ACTIVE 用户 + APPROVED 注册 + 默认角色 + UserAccount', async () => {
    const tx = txMock();
    const prisma = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
    const repo = new AuthIdentityRepository(prisma as any);
    const res = await repo.createOAuthUser({
      username: 'gh_alice', email: 'a@x.com', systemId: 's1', defaultRoleCode: 'USER',
      emailVerified: true, emailPlaceholder: false,
      account: { provider: 'google', providerAccountId: 'sub-1', accessToken: 'enc' },
    });
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ username: 'gh_alice', email: 'a@x.com', status: 'ACTIVE', password: null }),
    }));
    expect(tx.systemRegistration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'newU', systemId: 's1', status: 'APPROVED' }),
    }));
    expect(tx.userRole.create).toHaveBeenCalledWith({ data: { userId: 'newU', roleId: 'roleU' } });
    expect(tx.userAccount.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'newU', provider: 'google', providerAccountId: 'sub-1' }),
    }));
    expect(res).toEqual({ id: 'newU' });
  });

  it('createOAuthUser 写入 emailVerified', async () => {
    const tx = txMock();
    const prisma = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
    const repo = new AuthIdentityRepository(prisma as any);
    await repo.createOAuthUser({
      username: 'gh_x', email: 'gh_7@no-email.oauth.local', systemId: 's1', defaultRoleCode: 'USER',
      emailVerified: false, emailPlaceholder: true,
      account: { provider: 'github', providerAccountId: '7' },
    });
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ emailVerified: false }),
    }));
  });

  it('createOAuthUser 在缺默认角色时抛错（与激活流程一致，不静默跳过）', async () => {
    const tx = txMock();
    tx.role.findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
    const repo = new AuthIdentityRepository(prisma as any);
    await expect(
      repo.createOAuthUser({
        username: 'gh_alice', email: 'a@x.com', systemId: 's1', defaultRoleCode: 'USER',
        emailVerified: true, emailPlaceholder: false,
        account: { provider: 'google', providerAccountId: 'sub-1' },
      }),
    ).rejects.toThrow('该系统未配置默认用户角色(USER)，无法完成账号创建');
    expect(tx.userRole.create).not.toHaveBeenCalled();
  });
});

describe('绑定仓库方法', () => {
  it('hasOtherCredential：有密码则 true', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ password: 'hash' }) },
      userAccount: { count: vi.fn().mockResolvedValue(0) },
    };
    const repo = new AuthIdentityRepository(prisma as any);
    expect(await repo.hasOtherCredential('u1', 'github')).toBe(true);
  });
  it('hasOtherCredential：无密码但有其它三方则 true', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ password: null }) },
      userAccount: { count: vi.fn().mockResolvedValue(1) },
    };
    const repo = new AuthIdentityRepository(prisma as any);
    expect(await repo.hasOtherCredential('u1', 'github')).toBe(true);
    expect(prisma.userAccount.count).toHaveBeenCalledWith({ where: { userId: 'u1', provider: { not: 'github' } } });
  });
  it('hasOtherCredential：无密码且无其它三方则 false', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ password: null }) },
      userAccount: { count: vi.fn().mockResolvedValue(0) },
    };
    const repo = new AuthIdentityRepository(prisma as any);
    expect(await repo.hasOtherCredential('u1', 'github')).toBe(false);
  });
});
