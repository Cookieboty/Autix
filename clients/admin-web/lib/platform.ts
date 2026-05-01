'use client';

import {
  registerPlatform,
  type AuthAdapter,
  type NavigationAdapter,
  type EnvConfig,
} from '@autix/shared-lib';

type NextRouter = {
  push: (path: string) => void;
  replace: (path: string) => void;
};

let _initialized = false;
let _router: NextRouter | null = null;
let _pathname: string = '/';

export function bindRouter(router: NextRouter, pathname: string): void {
  _router = router;
  _pathname = pathname;
}

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
      localStorage.removeItem('user');
      localStorage.removeItem('menus');
      localStorage.removeItem('systems');
    },
    getUser: async () => {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    setUser: async (user) => {
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
      if (_router) _router.push(path);
      else window.location.href = path;
    },
    replace: (path) => {
      if (_router) _router.replace(path);
      else window.location.replace(path);
    },
    getPathname: () => _pathname || window.location.pathname,
  };

  const env: EnvConfig = {
    chatApiUrl: process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001',
    userApiUrl:
      process.env.NEXT_PUBLIC_USER_API_URL || 'http://localhost:4002/api',
    amuxHost: process.env.NEXT_PUBLIC_AMUX_HOST || 'https://api.amux.ai',
    amuxClientId: process.env.NEXT_PUBLIC_AMUX_CLIENT_ID || 'amux-admin',
  };

  registerPlatform({ auth, navigation, env });
  _initialized = true;
}

if (typeof window !== 'undefined') {
  initPlatform();
}
