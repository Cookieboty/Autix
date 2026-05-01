/** Web 端同步 auth 工具 — 直接操作 localStorage */
import type { AuthUser } from '@autix/types';
export { hasPermission } from '@autix/shared-lib';
export type { Menu, SystemInfo } from '@autix/shared-lib';

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser) {
  if (typeof window === 'undefined') return;
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
  localStorage.removeItem('user');
  localStorage.removeItem('menus');
  localStorage.removeItem('systems');
}
