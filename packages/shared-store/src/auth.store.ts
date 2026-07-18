import { create } from 'zustand';
import { checkAdmin } from '@autix/domain';
import type { AuthProfile, AuthProfileFeatures, AuthUser, AvatarPresignResult, BannerPresignResult, Menu, SystemInfo, UpdateOwnProfileInput } from '@autix/domain';
import { getAuth, getNavigation } from '@autix/platform';
import { storageApi, uploadToPresignedUrl, userApi, updateMyAutoPublish } from '@autix/sdk';

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

// T15.5: 收敛到 domain 的 AuthProfile（Omit<AuthUser,'avatarStorageKey'> & { menus?, systems?, features? }）。
// 之前本地 alias 保留 avatarStorageKey，与 domain 契约不一致；改用 domain 类型后，前端从类型层禁止误消费 avatarStorageKey。

export type AuthTokenPersistence = 'platform';

export interface AuthLoginOptions {
  tokenPersistence?: AuthTokenPersistence;
  includeTokenSystems?: boolean;
  /**
   * @deprecated T15.10：历史遗留选项。原语义是把 profile.menus/systems 也塞进 `state.user`，
   * 但 `state.user` 类型契约仅为 `AuthUser`，混入 menus/systems 是语义不干净。
   * 现有 2 处调用者（desktop/web admin login）从未真正读取 `user.menus / user.systems`，
   * 一直走独立的 `useAuthStore(s => s.menus / s.systems)`，因此本轮保留选项以维持源代码兼容，
   * 但在实现中改为 no-op（menus/systems 只落到 store 的对应字段，不再副作用回 user）。
   */
  keepProfileCollectionsOnUser?: boolean;
  storeProfileCollections?: boolean;
}

export interface AuthLoginResult {
  user: AuthUser;
  menus: Menu[];
  systems: SystemInfo[];
  features: AuthProfileFeatures;
  tokens: AuthTokenPair;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  menus: Menu[];
  systems: SystemInfo[];
  features: AuthProfileFeatures;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setUser: (user: AuthUser, menus?: Menu[], systems?: SystemInfo[], features?: AuthProfileFeatures) => void;
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
  features: {},
  hydrated: false,

  hydrate: async () => {
    const adapter = getAuth();
    const [user, menus, systems, features] = await Promise.all([
      adapter.getUser(),
      adapter.getMenus?.() ?? Promise.resolve([]),
      adapter.getSystems?.() ?? Promise.resolve([]),
      adapter.getFeatures?.() ?? Promise.resolve({}),
    ]);
    const u = user as AuthUser | null;
    set({
      user: u,
      isAuthenticated: !!u,
      isAdmin: checkAdmin(u),
      menus: menus as Menu[],
      systems: systems as SystemInfo[],
      features: features as AuthProfileFeatures,
      hydrated: true,
    });
  },

  setUser: (user, menus = [], systems = [], features = {}) => {
    const adapter = getAuth();
    void adapter.setUser(user);
    if (adapter.setMenus) void adapter.setMenus(menus);
    if (adapter.setSystems) void adapter.setSystems(systems);
    if (adapter.setFeatures) void adapter.setFeatures(features);
    set({
      user,
      isAuthenticated: true,
      isAdmin: checkAdmin(user),
      menus,
      systems,
      features,
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
      features: {},
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
  // T15.10: 严格把 user 收敛到 AuthUser 契约。menus/systems 只走 store 独立字段，
  // 不再依据 keepProfileCollectionsOnUser 副作用回 user（选项已 deprecated，行为等价）。
  const user = pickAuthUser(profile);
  const profileMenus = profile.menus ?? [];
  const profileSystems = profile.systems ?? [];
  const menus = options.storeProfileCollections === false ? [] : profileMenus;
  const storedProfileSystems = options.storeProfileCollections === false ? [] : profileSystems;
  const systems = options.includeTokenSystems
    ? tokens.systems ?? storedProfileSystems
    : storedProfileSystems;
  useAuthStore.getState().setUser(user, menus, systems, profile.features ?? {});
  return { user, menus, systems, features: profile.features ?? {}, tokens };
};

/**
 * T15.10: 从 `AuthProfile` 剥离 `menus / systems / features` 得到严格 `AuthUser` 视图。
 * 这三个字段是 profile 响应的"附加集合"，仅在 store 的独立字段中持久化，不应污染 `user`。
 */
export function pickAuthUser(profile: AuthProfile): AuthUser {
  const { menus: _menus, systems: _systems, features: _features, ...user } = profile;
  return user as AuthUser;
}

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

  fetchOAuthProviders: async (): Promise<{ providers: string[]; comingSoon: string[] }> => {
    const { data } = await userApi.get<{ providers?: string[]; comingSoon?: string[] }>('/auth/providers');
    return { providers: data.providers ?? [], comingSoon: data.comingSoon ?? [] };
  },

  getOAuthAuthorizeUrl: async (input: {
    provider: string;
    systemCode: string;
    redirectUri: string;
    inviteCode?: string;
  }): Promise<{ authorizeUrl: string }> => {
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
    return { authorizeUrl: data.authorizeUrl };
  },

  getLinkAuthorizeUrl: async (
    provider: string,
    // 安全（#3）：绑定登录凭据前必须带 step-up 一次性 proof。
    input: { systemCode: string; redirectUri: string; clientType?: 'web' | 'desktop'; proof: string },
  ): Promise<{ authorizeUrl: string }> => {
    const { data } = await userApi.post<{ authorizeUrl: string }>(`/auth/link/${provider}`, {
      systemCode: input.systemCode,
      clientType: input.clientType ?? 'web',
      redirectUri: input.redirectUri,
      proof: input.proof,
    });
    return { authorizeUrl: data.authorizeUrl };
  },

  startOAuth: async (input: {
    provider: string;
    systemCode: string;
    redirectUri: string;
    inviteCode?: string;
  }): Promise<void> => {
    const { authorizeUrl } = await authActions.getOAuthAuthorizeUrl(input);
    getNavigation().assign?.(authorizeUrl);
  },

  completeOAuthLogin: async (code: string): Promise<AuthLoginResult> => {
    const { data: tokens } = await userApi.post<AuthTokenPair>('/auth/exchange', { code });
    return loadSessionFromTokens(tokens);
  },

  listLinkedAccounts: async (): Promise<string[]> => {
    const { data } = await userApi.get<{ providers: string[] }>('/auth/linked-accounts');
    return data.providers;
  },

  unlinkAccount: async (provider: string, proof: string): Promise<void> => {
    // 安全（#3）：解绑登录凭据前必须带 step-up 一次性 proof。
    await userApi.delete(`/auth/unlink/${provider}`, { data: { proof } });
  },

  submitSupplementEmail: async (email: string): Promise<void> => {
    // Legacy alias：POST /auth/email 走 requestSupplement 分支（无 proof，仅当当前 email 为空可用）。
    // 已登录并需要"变更"邮箱的场景请改用 securityActions.requestEmailChange（带 step-up proof）。
    await userApi.post('/auth/email', { email });
  },

  confirmSupplementEmail: async (token: string): Promise<void> => {
    // 与 securityActions.confirmEmailChange 等价，保留旧命名给现有 email/confirm 页面。
    await userApi.post('/auth/email/confirm', { token });
  },

  linkAccount: async (
    provider: string,
    input: { systemCode: string; redirectUri: string; proof: string },
  ): Promise<void> => {
    const { authorizeUrl } = await authActions.getLinkAuthorizeUrl(provider, input);
    getNavigation().assign?.(authorizeUrl);
  },

  refreshProfile: async (): Promise<void> => {
    const { data: profile } = await userApi.get<AuthProfile>('/auth/profile');
      useAuthStore.getState().setUser(pickAuthUser(profile), profile.menus ?? [], profile.systems ?? [], profile.features ?? {});
  },

  /**
   * T13: 自助更新 profile。
   * - 白名单：nickname / description / avatar，其余字段前端不应传（后端 DTO 会剥离）
   * - 返回 AuthProfile 后立即 setUser 原子刷新缓存
   * - 错误由调用方处理（表单侧显示 400/401）
   * - T15.6: 入参统一走 domain 契约 UpdateOwnProfileInput
   * - T15.10: 走 pickAuthUser 收敛，避免 features/menus/systems 污染 store.user
   */
  updateOwnProfile: async (input: UpdateOwnProfileInput): Promise<AuthProfile> => {
    const { data: profile } = await userApi.patch<AuthProfile>('/auth/profile', input);
    useAuthStore.getState().setUser(pickAuthUser(profile), profile.menus ?? [], profile.systems ?? [], profile.features ?? {});
    return profile;
  },

  /**
   * T16: 头像上传三步流水（reservation-then-consume）。
   * 1. `POST /storage/avatar-presign` 拿 { uploadUrl, storageKey, publicUrl, expiresAt }
   * 2. PUT file → uploadUrl（走 SDK uploadToPresignedUrl）
   * 3. `PATCH /auth/profile` with `{ avatarStorageKey }` 消费 reservation
   *
   * 返回消费后的 AuthProfile（其中 `avatar` 已被后端更新为 CDN publicUrl）。
   * 错误处理：任一步失败原样抛出；reservation 若失败不消费，后端 cron 会走 PENDING_UPLOAD_EXPIRED
   * 兜底删对象。上层组件只需 try/catch 展示错误消息。
   */
  uploadAvatar: async (file: File): Promise<AuthProfile> => {
    // Step 1: presign
    const { data: reservation }: { data: AvatarPresignResult } = await storageApi.presignAvatarUpload({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    // Step 2: PUT to R2
    await uploadToPresignedUrl(reservation.uploadUrl, file, { contentType: file.type });
    // Step 3: consume via PATCH profile
    return authActions.updateOwnProfile({ avatarStorageKey: reservation.storageKey });
  },

  /**
   * Profile banner 上传三步流水，与 uploadAvatar 完全同构：
   * 1. `POST /storage/banner-presign` 2. PUT → R2 3. `PATCH /auth/profile { bannerStorageKey }`。
   * 返回消费后的 AuthProfile（`bannerImage` 已更新为 CDN publicUrl）。
   */
  uploadBanner: async (file: File): Promise<AuthProfile> => {
    const { data: reservation }: { data: BannerPresignResult } = await storageApi.presignBannerUpload({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    await uploadToPresignedUrl(reservation.uploadUrl, file, { contentType: file.type });
    return authActions.updateOwnProfile({ bannerStorageKey: reservation.storageKey });
  },

  /** 清空 profile banner（bannerImage=null 触发后端 BANNER_CLEARED 清理）。 */
  removeBanner: async (): Promise<AuthProfile> => {
    return authActions.updateOwnProfile({ bannerImage: null });
  },

  /**
   * 个人中心「Auto-publish」开关的唯一写入口。
   * - 服务端持久化经 SDK `updateMyAutoPublish`；
   * - 轻量回写：只更新 `user.autoPublish`，故意不走 `setUser`（会清空 menus/systems/features），
   *   采用与 `switchSystem` 相同的 `setState({ user }) + getAuth().setUser` 范式。
   */
  updateAutoPublish: async (autoPublish: boolean): Promise<void> => {
    await updateMyAutoPublish(autoPublish);
    const { user } = useAuthStore.getState();
    if (!user) return;
    const updated = { ...user, autoPublish };
    void getAuth().setUser(updated);
    useAuthStore.setState({ user: updated });
  },
};
