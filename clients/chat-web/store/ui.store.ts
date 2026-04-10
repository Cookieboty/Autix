import { create } from 'zustand';

type View = 'chat' | 'library';

interface UiState {
  currentView: View;
  setView: (v: View) => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentView: 'chat',
  setView: (v) => set({ currentView: v }),
}));
