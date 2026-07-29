import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockSetTokens = vi.fn();
const mockSetUser = vi.fn();
const mockSetFeatures = vi.fn();
const mockGetUser = vi.fn();
const mockGetFeatures = vi.fn();
const mockClearTokens = vi.fn();
const mockGetSessionItem = vi.fn();
const mockSetSessionItem = vi.fn();
const mockRemoveSessionItem = vi.fn();
const mockGetLanguage = vi.fn().mockResolvedValue('en');
const mockSetLanguage = vi.fn();

vi.mock('@autix/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@autix/sdk')>()),
  userApi: { post: mockPost, get: mockGet, delete: mockDelete },
}));

vi.mock('@autix/platform', () => ({
  getAuth: () => ({
    setTokens: mockSetTokens,
    setUser: mockSetUser,
    setFeatures: mockSetFeatures,
    getUser: mockGetUser,
    getFeatures: mockGetFeatures,
    clearTokens: mockClearTokens,
    getLanguage: mockGetLanguage,
    setLanguage: mockSetLanguage,
    getMenus: vi.fn().mockResolvedValue([]),
    getSystems: vi.fn().mockResolvedValue([]),
  }),
  getSessionStorage: () => ({
    getItem: mockGetSessionItem,
    setItem: mockSetSessionItem,
    removeItem: mockRemoveSessionItem,
  }),
  getNavigation: vi.fn(),
}));

describe('authActions.login 仍复用 loadSessionFromTokens', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('login 调 /auth/login 后走 persist + profile + setUser', async () => {
    const { authActions } = await import('./auth.store');
    mockPost.mockResolvedValueOnce({ data: { accessToken: 'AT', refreshToken: 'RT' } });
    mockGet.mockResolvedValueOnce({
      data: { id: 'u1', status: 'ACTIVE', menus: [], systems: [], features: { accountDeletion: true } },
    });
    const r = await authActions.login({ username: 'a', password: 'p' });
    expect(mockPost).toHaveBeenCalledWith('/auth/login', { username: 'a', password: 'p' });
    expect(mockGet).toHaveBeenCalledWith('/auth/profile');
    expect(r.user).toEqual(expect.objectContaining({ id: 'u1' }));
    expect(r.features).toEqual({ accountDeletion: true });
    expect(mockSetFeatures).toHaveBeenCalledWith({ accountDeletion: true });
    expect(mockRemoveSessionItem).toHaveBeenCalled();
  });
});

describe('auth store hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionItem.mockResolvedValue(null);
  });

  it('restores persisted profile feature flags instead of resetting them', async () => {
    const { useAuthStore } = await import('./auth.store');
    mockGetUser.mockResolvedValueOnce({ id: 'u1', status: 'ACTIVE', isSuperAdmin: false, permissions: [], roles: [] });
    mockGetFeatures.mockResolvedValueOnce({ nicknameEditable: true, accountDeletion: true });

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().features).toEqual({
      nicknameEditable: true,
      accountDeletion: true,
    });
  });

  it('derives the current system code and no longer exposes a local switchSystem setter', async () => {
    const { selectCurrentSystemCode, useAuthStore } = await import('./auth.store');
    const state = {
      ...useAuthStore.getState(),
      user: { id: 'u1', currentSystemId: 'sys-chat' },
      systems: [{ id: 'sys-chat', code: 'chat', name: 'Chat' }],
    } as never;
    expect(selectCurrentSystemCode(state)).toBe('chat');
    expect('switchSystem' in useAuthStore.getState()).toBe(false);
  });

  it('persists broken profile sync state and clears the marker when ready', async () => {
    const { ADMIN_PROFILE_SYNC_SESSION_KEY, useAuthStore } = await import('./auth.store');
    await useAuthStore.getState().setProfileSyncStatus('broken');
    expect(mockSetSessionItem).toHaveBeenCalledWith(ADMIN_PROFILE_SYNC_SESSION_KEY, '1');
    await useAuthStore.getState().setProfileSyncStatus('ready');
    expect(mockRemoveSessionItem).toHaveBeenCalledWith(ADMIN_PROFILE_SYNC_SESSION_KEY);
  });

  it('recovers a marked bootstrap before publishing hydrated state', async () => {
    const { ADMIN_PROFILE_SYNC_SESSION_KEY, useAuthStore } = await import('./auth.store');
    const { hydrateStores } = await import('./index');
    useAuthStore.setState({ hydrated: false, profileSyncStatus: 'ready' });
    mockGetSessionItem.mockResolvedValueOnce('1');
    mockGetUser.mockResolvedValueOnce({ id: 'old', status: 'ACTIVE', permissions: [], roles: [] });
    mockGetFeatures.mockResolvedValueOnce({});
    mockGet.mockResolvedValueOnce({ data: { id: 'fresh', status: 'ACTIVE', menus: [], systems: [], features: {} } });

    await hydrateStores('en');

    expect(mockGetSessionItem).toHaveBeenCalledWith(ADMIN_PROFILE_SYNC_SESSION_KEY);
    expect(useAuthStore.getState()).toMatchObject({ hydrated: true, profileSyncStatus: 'ready', user: { id: 'fresh' } });
    expect(mockRemoveSessionItem).toHaveBeenCalledWith(ADMIN_PROFILE_SYNC_SESSION_KEY);
  });

  it('hydrates without a profile request when no recovery marker exists', async () => {
    const { useAuthStore } = await import('./auth.store');
    const { hydrateStores } = await import('./index');
    useAuthStore.setState({ hydrated: false, profileSyncStatus: 'broken' });
    mockGetSessionItem.mockResolvedValueOnce(null);
    mockGetUser.mockResolvedValueOnce({ id: 'local', status: 'ACTIVE', permissions: [], roles: [] });
    mockGetFeatures.mockResolvedValueOnce({});

    await hydrateStores('en');

    expect(mockGet).not.toHaveBeenCalledWith('/auth/profile');
    expect(useAuthStore.getState()).toMatchObject({
      hydrated: true,
      profileSyncStatus: 'ready',
      user: { id: 'local' },
    });
  });

  it('publishes a broken hydrated state and preserves the marker when recovery fails', async () => {
    const { ADMIN_PROFILE_SYNC_SESSION_KEY, useAuthStore } = await import('./auth.store');
    const { hydrateStores } = await import('./index');
    useAuthStore.setState({ hydrated: false, profileSyncStatus: 'ready' });
    mockGetSessionItem.mockResolvedValueOnce('1');
    mockGetUser.mockResolvedValueOnce({ id: 'old', status: 'ACTIVE', permissions: [], roles: [] });
    mockGetFeatures.mockResolvedValueOnce({});
    mockGet.mockRejectedValueOnce(new Error('profile unavailable'));

    await hydrateStores('en');

    expect(useAuthStore.getState()).toMatchObject({
      hydrated: true,
      profileSyncStatus: 'broken',
      user: { id: 'old' },
    });
    expect(mockSetSessionItem).toHaveBeenCalledWith(
      ADMIN_PROFILE_SYNC_SESSION_KEY,
      '1',
    );
  });

  it('never exposes hydrated + ready with the stale local profile during recovery', async () => {
    const { useAuthStore } = await import('./auth.store');
    const { hydrateStores } = await import('./index');
    let resolveProfile!: (value: { data: Record<string, unknown> }) => void;
    const profilePromise = new Promise<{ data: Record<string, unknown> }>((resolve) => {
      resolveProfile = resolve;
    });
    const states: Array<{
      hydrated: boolean;
      status: string;
      userId: string | undefined;
    }> = [];
    const unsubscribe = useAuthStore.subscribe((state) => {
      states.push({
        hydrated: state.hydrated,
        status: state.profileSyncStatus,
        userId: state.user?.id,
      });
    });
    useAuthStore.setState({ hydrated: false, profileSyncStatus: 'ready' });
    mockGetSessionItem.mockResolvedValueOnce('1');
    mockGetUser.mockResolvedValueOnce({ id: 'old', status: 'ACTIVE', permissions: [], roles: [] });
    mockGetFeatures.mockResolvedValueOnce({});
    mockGet.mockReturnValueOnce(profilePromise);

    const hydration = hydrateStores('en');
    await vi.waitFor(() => expect(mockGet).toHaveBeenCalledWith('/auth/profile'));
    expect(useAuthStore.getState()).toMatchObject({
      hydrated: false,
      profileSyncStatus: 'syncing',
      user: { id: 'old' },
    });

    resolveProfile({
      data: { id: 'fresh', status: 'ACTIVE', menus: [], systems: [], features: {} },
    });
    await hydration;
    unsubscribe();

    expect(states).not.toContainEqual({
      hydrated: true,
      status: 'ready',
      userId: 'old',
    });
    expect(useAuthStore.getState()).toMatchObject({
      hydrated: true,
      profileSyncStatus: 'ready',
      user: { id: 'fresh' },
    });
  });
});

describe('profile synchronization recovery actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retryProfileSync only refreshes the profile and clears the broken marker', async () => {
    const { authActions, useAuthStore } = await import('./auth.store');
    useAuthStore.setState({ profileSyncStatus: 'broken' });
    mockGet.mockResolvedValueOnce({
      data: { id: 'fresh', status: 'ACTIVE', menus: [], systems: [], features: {} },
    });

    await authActions.retryProfileSync();

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith('/auth/profile');
    expect(useAuthStore.getState().profileSyncStatus).toBe('ready');
    expect(mockRemoveSessionItem).toHaveBeenCalled();
  });

  it('retryProfileSync keeps the global state broken and rethrows on failure', async () => {
    const { ADMIN_PROFILE_SYNC_SESSION_KEY, authActions, useAuthStore } = await import('./auth.store');
    const error = new Error('profile unavailable');
    useAuthStore.setState({ profileSyncStatus: 'broken' });
    mockGet.mockRejectedValueOnce(error);

    await expect(authActions.retryProfileSync()).rejects.toBe(error);

    expect(useAuthStore.getState().profileSyncStatus).toBe('broken');
    expect(mockSetSessionItem).toHaveBeenCalledWith(
      ADMIN_PROFILE_SYNC_SESSION_KEY,
      '1',
    );
  });

  it('logout returns to ready and clears the recovery marker', async () => {
    const { useAuthStore } = await import('./auth.store');
    useAuthStore.setState({ profileSyncStatus: 'broken' });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().profileSyncStatus).toBe('ready');
    expect(mockRemoveSessionItem).toHaveBeenCalled();
  });
});

describe('OAuth store actions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('fetchOAuthProviders 返回启用列表和 comingSoon 列表', async () => {
    const { authActions } = await import('./auth.store');
    mockGet.mockResolvedValueOnce({ data: { providers: ['google'], comingSoon: ['apple', 'github'] } });
    expect(await authActions.fetchOAuthProviders()).toEqual({ providers: ['google'], comingSoon: ['apple', 'github'] });
    expect(mockGet).toHaveBeenCalledWith('/auth/providers');
  });

  it('fetchOAuthProviders 当 comingSoon 缺省时返回空数组', async () => {
    const { authActions } = await import('./auth.store');
    mockGet.mockResolvedValueOnce({ data: { providers: ['google'] } });
    expect(await authActions.fetchOAuthProviders()).toEqual({ providers: ['google'], comingSoon: [] });
  });

  it('fetchOAuthProviders 当 providers 缺省时返回空数组', async () => {
    const { authActions } = await import('./auth.store');
    mockGet.mockResolvedValueOnce({ data: { comingSoon: ['apple'] } });
    expect(await authActions.fetchOAuthProviders()).toEqual({ providers: [], comingSoon: ['apple'] });
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

  it('getOAuthAuthorizeUrl 只取 authorizeUrl 不导航', async () => {
    const { authActions } = await import('./auth.store');
    mockGet.mockResolvedValueOnce({ data: { authorizeUrl: 'https://accounts.google/x' } });
    const r = await authActions.getOAuthAuthorizeUrl({
      provider: 'google', systemCode: 'sys', redirectUri: 'http://web/oauth/popup-callback?channel=c1',
    });
    expect(r).toEqual({ authorizeUrl: 'https://accounts.google/x' });
    expect(mockGet).toHaveBeenCalledWith('/auth/authorize/google', expect.objectContaining({
      params: expect.objectContaining({
        systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/popup-callback?channel=c1',
      }),
    }));
  });

  it('getOAuthAuthorizeUrl 透传 inviteCode', async () => {
    const { authActions } = await import('./auth.store');
    mockGet.mockResolvedValueOnce({ data: { authorizeUrl: 'https://accounts.google/x' } });
    await authActions.getOAuthAuthorizeUrl({
      provider: 'google', systemCode: 'sys', redirectUri: 'http://web/oauth/popup-callback?channel=c', inviteCode: 'IC',
    });
    expect(mockGet).toHaveBeenCalledWith('/auth/authorize/google', expect.objectContaining({
      params: expect.objectContaining({ inviteCode: 'IC' }),
    }));
  });

  it('getLinkAuthorizeUrl 只取 authorizeUrl 不导航', async () => {
    const { authActions } = await import('./auth.store');
    mockPost.mockResolvedValueOnce({ data: { authorizeUrl: 'https://accounts.google/link' } });
    const r = await authActions.getLinkAuthorizeUrl('google', {
      systemCode: 'sys', redirectUri: 'http://web/oauth/popup-callback?channel=c2', proof: 'proof-1',
    });
    expect(r).toEqual({ authorizeUrl: 'https://accounts.google/link' });
    expect(mockPost).toHaveBeenCalledWith('/auth/link/google', {
      systemCode: 'sys', clientType: 'web', redirectUri: 'http://web/oauth/popup-callback?channel=c2', proof: 'proof-1',
    });
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
    await authActions.unlinkAccount('github', 'proof-1');
    expect(mockDelete).toHaveBeenCalledWith('/auth/unlink/github', { data: { proof: 'proof-1' } });
  });

  it('linkAccount 取 authorizeUrl 后跳转', async () => {
    const assign = vi.fn();
    const { getNavigation } = await import('@autix/platform');
    (getNavigation as ReturnType<typeof vi.fn>).mockReturnValue({ assign });
    const { authActions } = await import('./auth.store');
    mockPost.mockResolvedValueOnce({ data: { authorizeUrl: 'https://u' } });
    await authActions.linkAccount('github', { systemCode: 'sys', redirectUri: 'http://web/oauth/callback', proof: 'proof-1' });
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
