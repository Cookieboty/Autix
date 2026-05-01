import { create } from 'zustand';
import type { AuthUser } from '@autix/types';
import { getAuth, checkAdmin } from '@autix/shared-lib';
import type { Menu, SystemInfo } from '@autix/shared-lib';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  menus: Menu[];
  systems: SystemInfo[];
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setUser: (user: AuthUser, menus?: Menu[], systems?: SystemInfo[]) => void;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  switchSystem: (systemId: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  menus: [],
  systems: [],
  hydrated: false,

  hydrate: async () => {
    const adapter = getAuth();
    const [user, menus, systems] = await Promise.all([
      adapter.getUser(),
      adapter.getMenus?.() ?? Promise.resolve([]),
      adapter.getSystems?.() ?? Promise.resolve([]),
    ]);
    const u = user as AuthUser | null;
    set({
      user: u,
      isAuthenticated: !!u,
      isAdmin: checkAdmin(u),
      menus: menus as Menu[],
      systems: systems as SystemInfo[],
      hydrated: true,
    });
  },

  setUser: (user, menus = [], systems = []) => {
    const adapter = getAuth();
    void adapter.setUser(user);
    if (adapter.setMenus) void adapter.setMenus(menus);
    if (adapter.setSystems) void adapter.setSystems(systems);
    set({
      user,
      isAuthenticated: true,
      isAdmin: checkAdmin(user),
      menus,
      systems,
    });
  },

  logout: async () => {
    await getAuth().clearTokens();
    set({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      menus: [],
      systems: [],
    });
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    if ((user as AuthUser & { isSuperAdmin?: boolean }).isSuperAdmin) return true;
    const permissions = Array.isArray(user.permissions)
      ? user.permissions.map((p) =>
          typeof p === 'string' ? p : (p as { code: string }).code,
        )
      : [];
    return permissions.includes(permission);
  },

  switchSystem: (systemId) => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, currentSystemId: systemId };
    void getAuth().setUser(updated);
    set({ user: updated });
  },
}));
