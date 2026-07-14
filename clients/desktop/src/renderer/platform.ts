import {
  registerPlatform,
  type AuthAdapter,
  type ClipboardAdapter,
  type NavigationAdapter,
  type EnvConfig,
  type OAuthStepUpAdapter,
  type OAuthLinkAdapter,
} from '@autix/platform';

type ReactRouter = {
  push: (path: string) => void;
  replace: (path: string) => void;
};

let _router: ReactRouter | null = null;
let _pathname: string = '/';
const _navigationListeners = new Set<() => void>();

export function bindRouter(router: ReactRouter, pathname: string): void {
  _router = router;
  const changed = _pathname !== pathname;
  _pathname = pathname;
  if (changed) notifyNavigationListeners();
}

function notifyNavigationListeners(): void {
  _navigationListeners.forEach((listener) => listener());
}

function syncPath(path: string): void {
  const next = path.split('?')[0] || '/';
  if (_pathname === next) return;
  _pathname = next;
  notifyNavigationListeners();
}

const auth: AuthAdapter = {
  getAccessToken: () => window.electron.auth.getAccessToken(),
  getRefreshToken: () => window.electron.auth.getRefreshToken(),
  setTokens: (access, refresh) => window.electron.auth.setTokens(access, refresh),
  clearTokens: () => window.electron.auth.clearTokens(),
  getUser: () => window.electron.auth.getUser(),
  setUser: (user) => window.electron.auth.setUser(user),
  getLanguage: () => window.electron.auth.getLanguage(),
  setLanguage: (lang) => window.electron.auth.setLanguage(lang),
  getMenus: () => window.electron.auth.getMenus(),
  setMenus: (menus) => window.electron.auth.setMenus(menus),
  getSystems: () => window.electron.auth.getSystems(),
  setSystems: (systems) => window.electron.auth.setSystems(systems),
  getFeatures: () => window.electron.auth.getFeatures(),
  setFeatures: (features) => window.electron.auth.setFeatures(features as Record<string, boolean>),
};

const navigation: NavigationAdapter = {
  push: (path) => {
    syncPath(path);
    if (_router) _router.push(path);
    else window.location.hash = `#${path}`;
  },
  replace: (path) => {
    syncPath(path);
    if (_router) _router.replace(path);
    else window.location.hash = `#${path}`;
  },
  assign: (url) => {
    window.location.assign(url);
  },
  getPathname: () => _pathname,
  switchLocale: () => {
    // desktop 没有 URL locale：语言切换由 IntlProvider 依 language store 重新
    // 加载 messages 完成，这里无需任何路由动作。
  },
  getSearch: () => '',
  getOrigin: () => window.location.origin,
  subscribe: (listener) => {
    _navigationListeners.add(listener);
    return () => _navigationListeners.delete(listener);
  },
};

const clipboard: ClipboardAdapter = {
  writeText: (text) => navigator.clipboard.writeText(text),
};

const oauthStepUp: OAuthStepUpAdapter = {
  reserve: (provider) => window.electron.auth.reserveStepUp(provider),
  complete: (input) => window.electron.auth.completeStepUp(input),
  cancel: (flowId) => window.electron.auth.cancelStepUp(flowId),
};

const oauthLink: OAuthLinkAdapter = {
  reserve: (provider) => window.electron.auth.reserveStepUp(provider),
  complete: (input) => window.electron.auth.completeLink(input),
  cancel: (flowId) => window.electron.auth.cancelStepUp(flowId),
};

/** 桌面端运行时配置：通过 import.meta.env 读 Vite 环境变量 */
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4100';

const env: EnvConfig = {
  apiUrl,
  chatApiUrl: apiUrl,
  userApiUrl: apiUrl,
};

registerPlatform({
  auth,
  navigation,
  env,
  clipboard,
  oauthStepUp,
  oauthLink,
  storage: {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
    subscribe: (listener) => {
      const onStorage = (event: StorageEvent) => {
        if (event.storageArea === window.localStorage) listener({ key: event.key });
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  },
  sessionStorage: typeof window !== 'undefined'
    ? {
        getItem: (key) => window.sessionStorage.getItem(key),
        setItem: (key, value) => window.sessionStorage.setItem(key, value),
        removeItem: (key) => window.sessionStorage.removeItem(key),
      }
    : undefined,
});
