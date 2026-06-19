import { create } from 'zustand';
import type { MarketplaceTypeSlug } from '@autix/sdk';

export type ResourcePanelSource = 'chat' | 'marketplace' | 'input' | 'detail';

interface ResourcePanelState {
  open: boolean;
  pinned: boolean;
  sidebarCollapsed: boolean;
  activeConversationId?: string;
  initialType?: MarketplaceTypeSlug;
  initialResourceId?: string;
  source?: ResourcePanelSource;
  openPanel: (args?: {
    type?: MarketplaceTypeSlug;
    resourceId?: string;
    conversationId?: string;
    source?: ResourcePanelSource;
  }) => void;
  closePanel: () => void;
  setPinned: (pinned: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveConversationId: (conversationId?: string) => void;
}

export const useResourcePanelStore = create<ResourcePanelState>((set) => ({
  open: false,
  pinned: false,
  sidebarCollapsed: false,
  openPanel: (args) =>
    set({
      open: true,
      initialType: args?.type,
      initialResourceId: args?.resourceId,
      activeConversationId: args?.conversationId,
      source: args?.source ?? 'chat',
    }),
  closePanel: () => set({ open: false, initialResourceId: undefined }),
  setPinned: (pinned) => set({ pinned }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
}));
