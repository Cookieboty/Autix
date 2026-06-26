import { AuthIdentityRepository } from './auth-identity.repository';

function txMock() {
  return {
    user: { create: jest.fn().mockResolvedValue({ id: 'newU' }) },
    systemRegistration: { create: jest.fn().mockResolvedValue({}) },
    role: { findFirst: jest.fn().mockResolvedValue({ id: 'roleU' }) },
    userRole: { create: jest.fn().mockResolvedValue({}) },
    userAccount: { create: jest.fn().mockResolvedValue({}) },
  };
}

describe('AuthIdentityRepository OAuth methods', () => {
  it('findUserAccount 命中返回 userId', async () => {
    const prisma = { userAccount: { findUnique: jest.fn().mockResolvedValue({ userId: 'u9' }) } };
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
    const prisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const repo = new AuthIdentityRepository(prisma as any);
    const res = await repo.createOAuthUser({
      username: 'gh_alice', email: 'a@x.com', systemId: 's1', defaultRoleCode: 'USER',
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

  it('createOAuthUser 在缺默认角色时抛错（与激活流程一致，不静默跳过）', async () => {
    const tx = txMock();
    tx.role.findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const repo = new AuthIdentityRepository(prisma as any);
    await expect(
      repo.createOAuthUser({
        username: 'gh_alice', email: 'a@x.com', systemId: 's1', defaultRoleCode: 'USER',
        account: { provider: 'google', providerAccountId: 'sub-1' },
      }),
    ).rejects.toThrow('该系统未配置默认用户角色(USER)，无法完成账号创建');
    expect(tx.userRole.create).not.toHaveBeenCalled();
  });
});
