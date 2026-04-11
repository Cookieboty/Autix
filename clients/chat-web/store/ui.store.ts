import { create } from 'zustand';

type View = 'chat' | 'library';

interface UiState {
  currentView: View;
  setView: (v: View) => void;
  notificationDrawerOpen: boolean;
  openNotificationDrawer: () => void;
  closeNotificationDrawer: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentView: 'chat',
  setView: (v) => set({ currentView: v }),
  notificationDrawerOpen: false,
  openNotificationDrawer: () => set({ notificationDrawerOpen: true }),
  closeNotificationDrawer: () => set({ notificationDrawerOpen: false }),
}));
