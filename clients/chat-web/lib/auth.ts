/**
 * Web 端同步 auth 工具 — 直接操作 localStorage，保持原 `@/lib/auth` 调用方兼容。
 * Desktop 端不应导入本文件，应通过 @autix/shared-lib 的 AuthAdapter。
 */
export { checkAdmin, hasPermission } from '@autix/shared-lib';
export type { Menu, SystemInfo } from '@autix/shared-lib';

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('chat_user') || localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('chat_user', JSON.stringify(user));
  localStorage.setItem('user', JSON.stringify(user));
}

export function getStoredMenus() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('menus');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function storeMenus(menus: unknown[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('menus', JSON.stringify(menus));
  }
}

export function getStoredSystems() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('systems');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function storeSystems(systems: unknown[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('systems', JSON.stringify(systems));
  }
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('chat_user');
  localStorage.removeItem('user');
  localStorage.removeItem('menus');
  localStorage.removeItem('systems');
}
