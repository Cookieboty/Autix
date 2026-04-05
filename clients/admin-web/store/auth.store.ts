import { create } from 'zustand';
import { AuthUser } from '@repo/types';
import { getStoredUser, storeUser, clearAuth } from '@/lib/auth';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  isAuthenticated: !!getStoredUser(),
  setUser: (user) => {
    storeUser(user);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    clearAuth();
    set({ user: null, isAuthenticated: false });
  },
  hasPermission: (permission) => {
    const { user } = get();
    return user?.permissions.includes(permission) ?? false;
  },
}));
