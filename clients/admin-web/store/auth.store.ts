import { create } from 'zustand';
import { AuthUser } from '@repo/types';
import { getStoredUser, storeUser, clearAuth, getStoredMenus, storeMenus } from '@/lib/auth';

interface Menu {
  id: string;
  name: string;
  path: string;
  icon?: string;
  parentId?: string | null;
  sort: number;
  visible: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  menus: Menu[];
  setUser: (user: AuthUser, menus?: Menu[]) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  isAuthenticated: !!getStoredUser(),
  menus: getStoredMenus(),
  setUser: (user, menus = []) => {
    storeUser(user);
    storeMenus(menus);
    set({ user, isAuthenticated: true, menus });
  },
  logout: () => {
    clearAuth();
    set({ user: null, isAuthenticated: false, menus: [] });
  },
  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    const permissions = Array.isArray(user.permissions) 
      ? user.permissions.map((p: any) => typeof p === 'string' ? p : p.code)
      : [];
    return permissions.includes(permission);
  },
}));
