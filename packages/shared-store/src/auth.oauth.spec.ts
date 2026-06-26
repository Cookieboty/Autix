import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockSetTokens = vi.fn();
const mockSetUser = vi.fn();

vi.mock('@autix/sdk', () => ({
  userApi: { post: mockPost, get: mockGet, delete: mockDelete },
}));

vi.mock('@autix/platform', () => ({
  getAuth: () => ({ setTokens: mockSetTokens, setUser: mockSetUser }),
  getNavigation: vi.fn(),
}));

describe('authActions.login 仍复用 loadSessionFromTokens', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('login 调 /auth/login 后走 persist + profile + setUser', async () => {
    const { authActions } = await import('./auth.store');
    mockPost.mockResolvedValueOnce({ data: { accessToken: 'AT', refreshToken: 'RT' } });
    mockGet.mockResolvedValueOnce({ data: { id: 'u1', status: 'ACTIVE', menus: [], systems: [] } });
    const r = await authActions.login({ username: 'a', password: 'p' });
    expect(mockPost).toHaveBeenCalledWith('/auth/login', { username: 'a', password: 'p' });
    expect(mockGet).toHaveBeenCalledWith('/auth/profile');
    expect(r.user).toEqual(expect.objectContaining({ id: 'u1' }));
  });
});

describe('OAuth store actions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('fetchOAuthProviders 返回启用列表', async () => {
    const { authActions } = await import('./auth.store');
    mockGet.mockResolvedValueOnce({ data: { providers: ['google'] } });
    expect(await authActions.fetchOAuthProviders()).toEqual(['google']);
    expect(mockGet).toHaveBeenCalledWith('/auth/providers');
  });

  it('startOAuth 取 authorizeUrl 后跳转', async () => {
    const assign = vi.fn();
    const { getNavigation } = await import('@autix/platform');
    (getNavigation as ReturnType<typeof vi.fn>).mockReturnValue({ assign });
    const { authActions } = await import('./auth.store');
    mockGet.mockResolvedValueOnce({ data: { authorizeUrl: 'https://accounts.google/x' } });
    await authActions.startOAuth({ provider: 'google', systemCode: 'sys', redirectUri: 'http://web/oauth/callback' });
    expect(mockGet).toHaveBeenCalledWith('/auth/authorize/google', expect.objectContaining({
      params: expect.objectContaining({ systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/callback' }),
    }));
    expect(assign).toHaveBeenCalledWith('https://accounts.google/x');
  });

  it('completeOAuthLogin 用一次性码换 token 并登录', async () => {
    const { authActions } = await import('./auth.store');
    mockPost.mockResolvedValueOnce({ data: { accessToken: 'AT', refreshToken: 'RT' } });
    mockGet.mockResolvedValueOnce({ data: { id: 'u1', status: 'ACTIVE', menus: [], systems: [] } });
    const r = await authActions.completeOAuthLogin('LC');
    expect(mockPost).toHaveBeenCalledWith('/auth/exchange', { code: 'LC' });
    expect(r.user).toEqual(expect.objectContaining({ id: 'u1' }));
  });
});

describe('linking store actions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('listLinkedAccounts 返回 providers', async () => {
    const { authActions } = await import('./auth.store');
    mockGet.mockResolvedValueOnce({ data: { providers: ['google'] } });
    expect(await authActions.listLinkedAccounts()).toEqual(['google']);
  });

  it('unlinkAccount 调 delete', async () => {
    const { authActions } = await import('./auth.store');
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    await authActions.unlinkAccount('github');
    expect(mockDelete).toHaveBeenCalledWith('/auth/unlink/github');
  });

  it('linkAccount 取 authorizeUrl 后跳转', async () => {
    const assign = vi.fn();
    const { getNavigation } = await import('@autix/platform');
    (getNavigation as ReturnType<typeof vi.fn>).mockReturnValue({ assign });
    const { authActions } = await import('./auth.store');
    mockPost.mockResolvedValueOnce({ data: { authorizeUrl: 'https://u' } });
    await authActions.linkAccount('github', { systemCode: 'sys', redirectUri: 'http://web/oauth/callback' });
    expect(mockPost).toHaveBeenCalledWith('/auth/link/github', expect.objectContaining({ clientType: 'web', systemCode: 'sys' }));
    expect(assign).toHaveBeenCalledWith('https://u');
  });
});

describe('supplement email actions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('submitSupplementEmail 调 POST /auth/email', async () => {
    const { authActions } = await import('./auth.store');
    mockPost.mockResolvedValueOnce({ data: { message: 'ok' } });
    await authActions.submitSupplementEmail('a@x.com');
    expect(mockPost).toHaveBeenCalledWith('/auth/email', { email: 'a@x.com' });
  });
  it('confirmSupplementEmail 调 POST /auth/email/confirm', async () => {
    const { authActions } = await import('./auth.store');
    mockPost.mockResolvedValueOnce({ data: { message: 'ok' } });
    await authActions.confirmSupplementEmail('TKN');
    expect(mockPost).toHaveBeenCalledWith('/auth/email/confirm', { token: 'TKN' });
  });
});

describe('refreshProfile action', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('refreshProfile calls GET /auth/profile and setUser', async () => {
    const { authActions } = await import('./auth.store');
    mockGet.mockResolvedValueOnce({ data: { id: 'u1', status: 'ACTIVE', emailVerified: true, menus: [{ id: 'm1' }], systems: [] } });
    await authActions.refreshProfile();
    expect(mockGet).toHaveBeenCalledWith('/auth/profile');
    expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', emailVerified: true }));
  });
});
