import { create } from 'zustand';
import { AuthUser } from '@repo/types';
import { getStoredUser, storeUser, clearAuth, getStoredMenus, storeMenus, getStoredSystems, storeSystems, SystemInfo } from '@/lib/auth';

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
  systems: SystemInfo[];
  setUser: (user: AuthUser, menus?: Menu[], systems?: SystemInfo[]) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  switchSystem: (systemId: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  isAuthenticated: !!getStoredUser(),
  menus: getStoredMenus(),
  systems: getStoredSystems(),
  setUser: (user, menus = [], systems = []) => {
    storeUser(user);
    storeMenus(menus);
    storeSystems(systems);
    set({ user, isAuthenticated: true, menus, systems });
  },
  logout: () => {
    clearAuth();
    set({ user: null, isAuthenticated: false, menus: [], systems: [] });
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
  switchSystem: (systemId) => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, currentSystemId: systemId };
    storeUser(updated);
    set({ user: updated });
  },
}));
