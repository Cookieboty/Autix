/**
 * 平台适配器 — 让共享代码在 web (Next.js localStorage) 和 desktop (Electron safeStorage IPC)
 * 之间无差别运行的关键抽象。
 *
 * 用法：
 *   - web 在根 layout 顶层调用 registerPlatform()，注入 localStorage 实现
 *   - desktop 在渲染进程入口调用 registerPlatform()，注入 IPC 实现
 *   - 共享层（api.ts / auth.store / 业务组件）通过 getAuth() / getNavigation() 间接访问
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
  getPathname(): string;
  getSearch?(): string;
  subscribe?(listener: () => void): () => void;
}

export interface EnvConfig {
  apiUrl: string;
  chatApiUrl: string;
  userApiUrl: string;
  amuxHost: string;
  amuxClientId: string;
}

let _auth: AuthAdapter | null = null;
let _nav: NavigationAdapter | null = null;
let _env: EnvConfig | null = null;

export function registerPlatform(opts: {
  auth: AuthAdapter;
  navigation: NavigationAdapter;
  env: EnvConfig;
}): void {
  _auth = opts.auth;
  _nav = opts.navigation;
  _env = opts.env;
}

export function getAuth(): AuthAdapter {
  if (!_auth) {
    throw new Error(
      '[@autix/shared-lib] AuthAdapter 未注册。请在应用入口调用 registerPlatform()',
    );
  }
  return _auth;
}

export function getNavigation(): NavigationAdapter {
  if (!_nav) {
    throw new Error(
      '[@autix/shared-lib] NavigationAdapter 未注册。请在应用入口调用 registerPlatform()',
    );
  }
  return _nav;
}

export function getEnv(): EnvConfig {
  if (!_env) {
    throw new Error('[@autix/shared-lib] Env 未注册。请在应用入口调用 registerPlatform()');
  }
  return _env;
}

export function isPlatformReady(): boolean {
  return _auth !== null && _nav !== null && _env !== null;
}
