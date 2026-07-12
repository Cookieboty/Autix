/**
 * Platform adapter singleton.
 *
 * Web and Desktop register their runtime capabilities once at app bootstrap.
 * Shared packages consume these adapters instead of touching localStorage,
 * Electron IPC, navigation, or environment variables directly.
 */

export interface AuthAdapter {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(access: string, refresh: string): Promise<void>;
  clearTokens(): Promise<void>;

  getUser(): Promise<unknown | null>;
  setUser(user: unknown): Promise<void>;

  getLanguage(): Promise<string | null>;
  setLanguage(lang: string): Promise<void>;

  getMenus?(): Promise<unknown[]>;
  setMenus?(menus: unknown[]): Promise<void>;
  getSystems?(): Promise<unknown[]>;
  setSystems?(systems: unknown[]): Promise<void>;
  getFeatures?(): Promise<object>;
  setFeatures?(features: object): Promise<void>;
}

export interface NavigationAdapter {
  push(path: string): void;
  replace(path: string): void;
  assign?(url: string): void;

  /**
   * 应用内逻辑路径，**不含 locale 前缀**。
   * web 实现须剥离 `/ja` 等前缀（next-intl 的 usePathname 已如此）；
   * desktop 无 URL locale，原样返回。
   */
  getPathname(): string;

  /** 切换语言。web: router.replace(pathname, {locale})；desktop: no-op 路由，仅重载 IntlProvider。 */
  switchLocale(locale: string): void;

  getSearch?(): string;
  getOrigin?(): string;
  subscribe?(listener: () => void): () => void;
}

export interface ClipboardAdapter {
  writeText(text: string): Promise<void> | void;
}

export interface OAuthStepUpAdapter {
  reserve(provider: string): Promise<{ redirectUri: string; flowId: string }>;
  complete(input: {
    flowId: string;
    authorizeUrl: string;
    expectedPurpose: string;
  }): Promise<{ proof: string; purpose: string }>;
  cancel(flowId: string): Promise<void>;
}

export interface OAuthLinkAdapter {
  reserve(provider: string): Promise<{ redirectUri: string; flowId: string }>;
  complete(input: {
    flowId: string;
    authorizeUrl: string;
    expectedProvider: string;
  }): Promise<{ linked: string }>;
  cancel(flowId: string): Promise<void>;
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
  subscribe?(listener: (event: { key: string | null }) => void): () => void;
}

export interface EnvConfig {
  apiUrl: string;
  chatApiUrl: string;
  userApiUrl: string;
}

let auth: AuthAdapter | null = null;
let navigation: NavigationAdapter | null = null;
let env: EnvConfig | null = null;
let storage: StorageAdapter | null = null;
let sessionStorage_: StorageAdapter | null = null;
let clipboard: ClipboardAdapter | null = null;
let oauthStepUp: OAuthStepUpAdapter | null = null;
let oauthLink: OAuthLinkAdapter | null = null;
const memoryStorage = new Map<string, string>();
const sessionMemoryStorage = new Map<string, string>();

const fallbackStorage: StorageAdapter = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => {
    memoryStorage.set(key, value);
  },
  removeItem: (key) => {
    memoryStorage.delete(key);
  },
};

const fallbackSessionStorage: StorageAdapter = {
  getItem: (key) => sessionMemoryStorage.get(key) ?? null,
  setItem: (key, value) => {
    sessionMemoryStorage.set(key, value);
  },
  removeItem: (key) => {
    sessionMemoryStorage.delete(key);
  },
};

export function registerPlatform(opts: {
  auth: AuthAdapter;
  navigation: NavigationAdapter;
  env: EnvConfig;
  storage?: StorageAdapter;
  sessionStorage?: StorageAdapter;
  clipboard?: ClipboardAdapter;
  oauthStepUp?: OAuthStepUpAdapter;
  oauthLink?: OAuthLinkAdapter;
}): void {
  auth = opts.auth;
  navigation = opts.navigation;
  env = opts.env;
  storage = opts.storage ?? fallbackStorage;
  sessionStorage_ = opts.sessionStorage ?? null;
  clipboard = opts.clipboard ?? null;
  oauthStepUp = opts.oauthStepUp ?? null;
  oauthLink = opts.oauthLink ?? null;
}

export function getAuth(): AuthAdapter {
  if (!auth) {
    throw new Error(
      '[@autix/platform] AuthAdapter is not registered. Call registerPlatform() at the app entry point.',
    );
  }
  return auth;
}

export function getNavigation(): NavigationAdapter {
  if (!navigation) {
    throw new Error(
      '[@autix/platform] NavigationAdapter is not registered. Call registerPlatform() at the app entry point.',
    );
  }
  return navigation;
}

export function getEnv(): EnvConfig {
  if (!env) {
    throw new Error('[@autix/platform] Env is not registered. Call registerPlatform() at the app entry point.');
  }
  return env;
}

export function getStorage(): StorageAdapter {
  return storage ?? fallbackStorage;
}

export function getSessionStorage(): StorageAdapter {
  return sessionStorage_ ?? fallbackSessionStorage;
}

export function getClipboard(): ClipboardAdapter {
  if (!clipboard) {
    throw new Error(
      '[@autix/platform] ClipboardAdapter is not registered. Call registerPlatform() at the app entry point.',
    );
  }
  return clipboard;
}

export function getOAuthStepUp(): OAuthStepUpAdapter | null {
  return oauthStepUp;
}

export function getOAuthLink(): OAuthLinkAdapter | null {
  return oauthLink;
}

export function isPlatformReady(): boolean {
  return auth !== null && navigation !== null && env !== null;
}
