import {
  registerPlatform,
  type AuthAdapter,
  type NavigationAdapter,
  type EnvConfig,
} from '@autix/shared-lib';

type ReactRouter = {
  push: (path: string) => void;
  replace: (path: string) => void;
};

let _router: ReactRouter | null = null;
let _pathname: string = '/';

export function bindRouter(router: ReactRouter, pathname: string): void {
  _router = router;
  _pathname = pathname;
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
};

const navigation: NavigationAdapter = {
  push: (path) => {
    if (_router) _router.push(path);
    else window.location.hash = `#${path}`;
  },
  replace: (path) => {
    if (_router) _router.replace(path);
    else window.location.hash = `#${path}`;
  },
  getPathname: () => _pathname,
};

/** 桌面端运行时配置：通过 import.meta.env 读 Vite 环境变量 */
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const env: EnvConfig = {
  apiUrl,
  chatApiUrl: apiUrl,
  userApiUrl: apiUrl,
  amuxHost: import.meta.env.VITE_AMUX_HOST ?? 'https://api.amux.ai',
  amuxClientId: import.meta.env.VITE_AMUX_CLIENT_ID ?? 'amux-desktop',
};

registerPlatform({ auth, navigation, env });
