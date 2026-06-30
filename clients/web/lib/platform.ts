'use client';

import {
  registerPlatform,
  type AuthAdapter,
  type ClipboardAdapter,
  type NavigationAdapter,
  type EnvConfig,
} from '@autix/platform';

type NextRouter = {
  push: (path: string) => void;
  replace: (path: string) => void;
};

let _initialized = false;
let _router: NextRouter | null = null;
let _pathname: string = '/';
let _search: string = typeof window !== 'undefined' ? window.location.search : '';
const _navigationListeners = new Set<() => void>();

/** 由根布局的 PlatformBinder 调用，把 next/navigation 的 router 绑进 NavigationAdapter */
export function bindRouter(router: NextRouter, pathname: string, search = ''): void {
  _router = router;
  const nextSearch = search ? `?${search.replace(/^\?/, '')}` : '';
  const changed = _pathname !== pathname || _search !== nextSearch;
  _pathname = pathname;
  _search = nextSearch;
  if (changed) notifyNavigationListeners();
}

function notifyNavigationListeners(): void {
  _navigationListeners.forEach((listener) => listener());
}

function syncPathFromHref(path: string): void {
  try {
    const url = new URL(path, window.location.origin);
    const changed = _pathname !== url.pathname || _search !== url.search;
    _pathname = url.pathname;
    _search = url.search;
    if (changed) notifyNavigationListeners();
  } catch {
    // Keep the last known route for non-URL navigation targets.
  }
}

/**
 * Web 端平台注入：localStorage 持久化 + Next.js router 导航。
 * 模块加载即调用一次，注册基础 adapter。
 */
function initPlatform(): void {
  if (_initialized) return;
  if (typeof window === 'undefined') return;

  const auth: AuthAdapter = {
    getAccessToken: async () => localStorage.getItem('accessToken'),
    getRefreshToken: async () => localStorage.getItem('refreshToken'),
    setTokens: async (access, refresh) => {
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
    },
    clearTokens: async () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('chat_user');
      localStorage.removeItem('user');
      localStorage.removeItem('menus');
      localStorage.removeItem('systems');
    },
    getUser: async () => {
      try {
        const raw =
          localStorage.getItem('chat_user') || localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    setUser: async (user) => {
      localStorage.setItem('chat_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
    },
    getLanguage: async () => localStorage.getItem('language'),
    setLanguage: async (lang) => {
      localStorage.setItem('language', lang);
    },
    getMenus: async () => {
      try {
        const raw = localStorage.getItem('menus');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    setMenus: async (menus) => {
      localStorage.setItem('menus', JSON.stringify(menus));
    },
    getSystems: async () => {
      try {
        const raw = localStorage.getItem('systems');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    setSystems: async (systems) => {
      localStorage.setItem('systems', JSON.stringify(systems));
    },
  };

  const navigation: NavigationAdapter = {
    push: (path) => {
      syncPathFromHref(path);
      if (_router) _router.push(path);
      else window.location.href = path;
    },
    replace: (path) => {
      syncPathFromHref(path);
      if (_router) _router.replace(path);
      else window.location.replace(path);
    },
    assign: (url) => {
      window.location.assign(url);
    },
    getPathname: () => _pathname || window.location.pathname,
    getSearch: () => _search,
    getOrigin: () => window.location.origin,
    subscribe: (listener) => {
      _navigationListeners.add(listener);
      return () => _navigationListeners.delete(listener);
    },
  };

  const clipboard: ClipboardAdapter = {
    writeText: (text) => navigator.clipboard.writeText(text),
  };

  const env: EnvConfig = {
    apiUrl: '',
    chatApiUrl: '',
    userApiUrl: '',
  };

  registerPlatform({
    auth,
    navigation,
    env,
    clipboard,
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
      subscribe: (listener) => {
        const onStorage = (event: StorageEvent) => {
          if (event.storageArea === localStorage) listener({ key: event.key });
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
  _initialized = true;
}

if (typeof window !== 'undefined') {
  initPlatform();
}
