import { AccountResolutionService } from './account-resolution.service';

function makeRepo(over: any = {}) {
  return {
    findUserAccount: jest.fn().mockResolvedValue(null),
    findUserByEmail: jest.fn().mockResolvedValue(null),
    findUserByUsername: jest.fn().mockResolvedValue(null),
    createUserAccount: jest.fn().mockResolvedValue(undefined),
    createOAuthUser: jest.fn().mockResolvedValue({ id: 'newU' }),
    ...over,
  };
}
const cipher = { encrypt: (s: string) => `enc(${s})` } as any;
const ctx = { systemId: 's1', defaultRoleCode: 'USER' };
function profile(over: any = {}) {
  return { provider: 'google', providerAccountId: 'sub1', email: 'a@x.com',
    emailVerified: true, displayName: 'A', avatar: null, raw: {}, tokens: { accessToken: 'at' }, ...over };
}

describe('AccountResolutionService', () => {
  it('§6.1 已绑定 → login 现有用户', async () => {
    const repo = makeRepo({ findUserAccount: jest.fn().mockResolvedValue({ userId: 'u9' }) });
    const svc = new AccountResolutionService(repo as any, cipher);
    expect(await svc.resolve(profile(), ctx)).toEqual({ kind: 'login', userId: 'u9', created: false });
  });
  it('§6.2 邮箱已验证撞库 → 自动关联', async () => {
    const repo = makeRepo({ findUserByEmail: jest.fn().mockResolvedValue({ id: 'u5' }) });
    const svc = new AccountResolutionService(repo as any, cipher);
    expect(await svc.resolve(profile(), ctx)).toEqual({ kind: 'login', userId: 'u5', created: false });
    expect(repo.createUserAccount).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u5', providerAccountId: 'sub1' }));
  });
  it('§6.3 邮箱未验证撞库 → 冲突', async () => {
    const repo = makeRepo({ findUserByEmail: jest.fn().mockResolvedValue({ id: 'u5' }) });
    const svc = new AccountResolutionService(repo as any, cipher);
    expect(await svc.resolve(profile({ emailVerified: false }), ctx)).toEqual({ kind: 'conflict', code: 'OAUTH_EMAIL_UNVERIFIED_CONFLICT' });
    expect(repo.createUserAccount).not.toHaveBeenCalled();
  });
  it('§6.4 全新用户 → createOAuthUser', async () => {
    const repo = makeRepo();
    const svc = new AccountResolutionService(repo as any, cipher);
    expect(await svc.resolve(profile({ email: null, emailVerified: false }), ctx)).toEqual({ kind: 'login', userId: 'newU', created: true });
    expect(repo.createOAuthUser).toHaveBeenCalled();
  });
  it('§6.4 无邮箱 → 建号 emailVerified=false 且占位', async () => {
    const repo = makeRepo();
    const svc = new AccountResolutionService(repo as any, cipher);
    await svc.resolve(profile({ email: null, emailVerified: false }), ctx);
    expect(repo.createOAuthUser).toHaveBeenCalledWith(expect.objectContaining({
      emailVerified: false, emailPlaceholder: true,
    }));
  });
  it('§6.4 有已验证邮箱 → emailVerified=true 非占位', async () => {
    const repo = makeRepo();
    const svc = new AccountResolutionService(repo as any, cipher);
    await svc.resolve(profile({ email: 'a@x.com', emailVerified: true, providerAccountId: 'sub9' }), ctx);
    expect(repo.createOAuthUser).toHaveBeenCalledWith(expect.objectContaining({
      emailVerified: true, emailPlaceholder: false,
    }));
  });
});
