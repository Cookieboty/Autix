import { create } from 'zustand';
import { checkAdmin } from '@autix/domain';
import type { AuthUser, Menu, SystemInfo } from '@autix/domain';
import { getAuth, getNavigation } from '@autix/platform';
import { userApi } from '@autix/sdk';

export interface AuthLoginInput {
  username: string;
  password: string;
}

export interface AuthRegisterInput {
  username: string;
  email: string;
  password: string;
  systemCode: string;
  inviteCode?: string;
}

export interface AuthRegisterResult {
  requiresActivation?: boolean;
  message?: string;
}

interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  systems?: SystemInfo[];
}

type AuthProfile = AuthUser & {
  menus?: Menu[];
  systems?: SystemInfo[];
};

export type AuthTokenPersistence = 'platform';

export interface AuthLoginOptions {
  tokenPersistence?: AuthTokenPersistence;
  includeTokenSystems?: boolean;
  keepProfileCollectionsOnUser?: boolean;
  storeProfileCollections?: boolean;
}

export interface AuthLoginResult {
  user: AuthUser;
  menus: Menu[];
  systems: SystemInfo[];
  tokens: AuthTokenPair;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  menus: Menu[];
  systems: SystemInfo[];
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setUser: (user: AuthUser, menus?: Menu[], systems?: SystemInfo[]) => void;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  switchSystem: (systemId: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  menus: [],
  systems: [],
  hydrated: false,

  hydrate: async () => {
    const adapter = getAuth();
    const [user, menus, systems] = await Promise.all([
      adapter.getUser(),
      adapter.getMenus?.() ?? Promise.resolve([]),
      adapter.getSystems?.() ?? Promise.resolve([]),
    ]);
    const u = user as AuthUser | null;
    set({
      user: u,
      isAuthenticated: !!u,
      isAdmin: checkAdmin(u),
      menus: menus as Menu[],
      systems: systems as SystemInfo[],
      hydrated: true,
    });
  },

  setUser: (user, menus = [], systems = []) => {
    const adapter = getAuth();
    void adapter.setUser(user);
    if (adapter.setMenus) void adapter.setMenus(menus);
    if (adapter.setSystems) void adapter.setSystems(systems);
    set({
      user,
      isAuthenticated: true,
      isAdmin: checkAdmin(user),
      menus,
      systems,
    });
  },

  logout: async () => {
    await getAuth().clearTokens();
    set({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      menus: [],
      systems: [],
    });
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    if ((user as AuthUser & { isSuperAdmin?: boolean }).isSuperAdmin) return true;
    const permissions = Array.isArray(user.permissions)
      ? user.permissions.map((p) =>
          typeof p === 'string' ? p : (p as { code: string }).code,
        )
      : [];
    return permissions.includes(permission);
  },

  switchSystem: (systemId) => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, currentSystemId: systemId };
    void getAuth().setUser(updated);
    set({ user: updated });
  },
}));

const persistTokens = async (
  tokens: AuthTokenPair,
  _persistence: AuthTokenPersistence = 'platform',
) => {
  await getAuth().setTokens(tokens.accessToken, tokens.refreshToken);
};

const loadSessionFromTokens = async (
  tokens: AuthTokenPair,
  options: AuthLoginOptions = {},
): Promise<AuthLoginResult> => {
  await persistTokens(tokens, options.tokenPersistence);
  const { data: profile } = await userApi.get<AuthProfile>('/auth/profile');
  const { menus: profileMenus = [], systems: profileSystems = [], ...profileUser } = profile;
  const user = options.keepProfileCollectionsOnUser ? profile : profileUser;
  const menus = options.storeProfileCollections === false ? [] : profileMenus;
  const storedProfileSystems = options.storeProfileCollections === false ? [] : profileSystems;
  const systems = options.includeTokenSystems
    ? tokens.systems ?? storedProfileSystems
    : storedProfileSystems;
  useAuthStore.getState().setUser(user, menus, systems);
  return { user, menus, systems, tokens };
};

export const authActions = {
  login: async (
    input: AuthLoginInput,
    options: AuthLoginOptions = {},
  ): Promise<AuthLoginResult> => {
    const { data: tokens } = await userApi.post<AuthTokenPair>('/auth/login', input);
    return loadSessionFromTokens(tokens, options);
  },

  register: async (input: AuthRegisterInput): Promise<AuthRegisterResult | undefined> => {
    const { data } = await userApi.post<AuthRegisterResult>('/auth/register', input);
    return data;
  },

  activate: (token: string) => userApi.post('/auth/activate', { token }),

  sendForgotPasswordEmail: (email: string) =>
    userApi.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    userApi.post('/auth/reset-password', { token, newPassword }),

  resendActivation: async (email: string): Promise<{ message?: string }> => {
    const { data } = await userApi.post<{ message?: string }>(
      '/auth/resend-activation',
      { email },
    );
    return data;
  },

  fetchOAuthProviders: async (): Promise<string[]> => {
    const { data } = await userApi.get<{ providers: string[] }>('/auth/providers');
    return data.providers;
  },

  startOAuth: async (input: {
    provider: string;
    systemCode: string;
    redirectUri: string;
    inviteCode?: string;
  }): Promise<void> => {
    const { data } = await userApi.get<{ authorizeUrl: string }>(
      `/auth/authorize/${input.provider}`,
      {
        params: {
          systemCode: input.systemCode,
          clientType: 'web',
          redirectUri: input.redirectUri,
          inviteCode: input.inviteCode,
        },
      },
    );
    getNavigation().assign?.(data.authorizeUrl);
  },

  completeOAuthLogin: async (code: string): Promise<AuthLoginResult> => {
    const { data: tokens } = await userApi.post<AuthTokenPair>('/auth/exchange', { code });
    return loadSessionFromTokens(tokens);
  },

  listLinkedAccounts: async (): Promise<string[]> => {
    const { data } = await userApi.get<{ providers: string[] }>('/auth/linked-accounts');
    return data.providers;
  },

  unlinkAccount: async (provider: string): Promise<void> => {
    await userApi.delete(`/auth/unlink/${provider}`);
  },

  submitSupplementEmail: async (email: string): Promise<void> => {
    await userApi.post('/auth/email', { email });
  },

  confirmSupplementEmail: async (token: string): Promise<void> => {
    await userApi.post('/auth/email/confirm', { token });
  },

  linkAccount: async (
    provider: string,
    input: { systemCode: string; redirectUri: string },
  ): Promise<void> => {
    const { data } = await userApi.post<{ authorizeUrl: string }>(`/auth/link/${provider}`, {
      systemCode: input.systemCode,
      clientType: 'web',
      redirectUri: input.redirectUri,
    });
    getNavigation().assign?.(data.authorizeUrl);
  },
};
