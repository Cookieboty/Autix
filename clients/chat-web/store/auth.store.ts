import { create } from 'zustand';
import { getStoredUser, storeUser, clearAuth } from '@/lib/auth';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setUser: (user: any) => void;
  logout: () => void;
}

function checkAdmin(user: any): boolean {
  if (!user) return false;
  const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
  return !!user.isSuperAdmin || roles.includes('SYSTEM_ADMIN');
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  isAuthenticated: !!getStoredUser(),
  isAdmin: checkAdmin(getStoredUser()),
  setUser: (user) => {
    storeUser(user);
    set({ user, isAuthenticated: true, isAdmin: checkAdmin(user) });
  },
  logout: () => {
    clearAuth();
    set({ user: null, isAuthenticated: false, isAdmin: false });
  },
}));
