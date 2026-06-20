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
}

export interface NavigationAdapter {
  push(path: string): void;
  replace(path: string): void;
  assign?(url: string): void;
  getPathname(): string;
  getSearch?(): string;
  getOrigin?(): string;
  subscribe?(listener: () => void): () => void;
}

export interface ClipboardAdapter {
  writeText(text: string): Promise<void> | void;
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
  amuxHost: string;
  amuxClientId: string;
}

let auth: AuthAdapter | null = null;
let navigation: NavigationAdapter | null = null;
let env: EnvConfig | null = null;
let storage: StorageAdapter | null = null;
let clipboard: ClipboardAdapter | null = null;
const memoryStorage = new Map<string, string>();

const fallbackStorage: StorageAdapter = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => {
    memoryStorage.set(key, value);
  },
  removeItem: (key) => {
    memoryStorage.delete(key);
  },
};

export function registerPlatform(opts: {
  auth: AuthAdapter;
  navigation: NavigationAdapter;
  env: EnvConfig;
  storage?: StorageAdapter;
  clipboard?: ClipboardAdapter;
}): void {
  auth = opts.auth;
  navigation = opts.navigation;
  env = opts.env;
  storage = opts.storage ?? fallbackStorage;
  clipboard = opts.clipboard ?? null;
}

export function getAuth(): AuthAdapter {
  if (!auth) {
    throw new Error(
      '[@autix/platform] AuthAdapter 未注册。请在应用入口调用 registerPlatform()',
    );
  }
  return auth;
}

export function getNavigation(): NavigationAdapter {
  if (!navigation) {
    throw new Error(
      '[@autix/platform] NavigationAdapter 未注册。请在应用入口调用 registerPlatform()',
    );
  }
  return navigation;
}

export function getEnv(): EnvConfig {
  if (!env) {
    throw new Error('[@autix/platform] Env 未注册。请在应用入口调用 registerPlatform()');
  }
  return env;
}

export function getStorage(): StorageAdapter {
  return storage ?? fallbackStorage;
}

export function getClipboard(): ClipboardAdapter {
  if (!clipboard) {
    throw new Error(
      '[@autix/platform] ClipboardAdapter 未注册。请在应用入口调用 registerPlatform()',
    );
  }
  return clipboard;
}

export function isPlatformReady(): boolean {
  return auth !== null && navigation !== null && env !== null;
}
