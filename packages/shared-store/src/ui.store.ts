import { create } from 'zustand';

type View = 'chat' | 'library';
export type AuthModalMode = 'entry' | 'login' | 'register' | 'forgot';

type AuthModalOptions = {
  mode?: AuthModalMode;
  returnTo?: string | null;
};

interface UiState {
  currentView: View;
  setView: (v: View) => void;
  notificationDrawerOpen: boolean;
  openNotificationDrawer: () => void;
  closeNotificationDrawer: () => void;
  authModalOpen: boolean;
  authModalMode: AuthModalMode;
  authModalReturnTo: string | null;
  openAuthModal: (options?: AuthModalOptions) => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: AuthModalMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentView: 'chat',
  setView: (v) => set({ currentView: v }),
  notificationDrawerOpen: false,
  openNotificationDrawer: () => set({ notificationDrawerOpen: true }),
  closeNotificationDrawer: () => set({ notificationDrawerOpen: false }),
  authModalOpen: false,
  authModalMode: 'entry',
  authModalReturnTo: null,
  openAuthModal: (options = {}) =>
    set({
      authModalOpen: true,
      authModalMode: options.mode ?? 'entry',
      authModalReturnTo: options.returnTo ?? null,
    }),
  closeAuthModal: () => set({ authModalOpen: false }),
  setAuthModalMode: (mode) => set({ authModalMode: mode }),
}));
