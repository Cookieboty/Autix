import { AuthUser } from '@repo/types';

interface Menu {
  id: string;
  name: string;
  path: string;
  icon?: string;
  parentId?: string | null;
  sort: number;
  visible: boolean;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function getStoredMenus(): Menu[] {
  if (typeof window === 'undefined') return [];
  try {
    const menus = localStorage.getItem('menus');
    return menus ? JSON.parse(menus) : [];
  } catch {
    return [];
  }
}

export function storeMenus(menus: Menu[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('menus', JSON.stringify(menus));
  }
}

export function clearAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('menus');
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return user?.permissions.includes(permission) ?? false;
}
