'use client';

import { useState, useEffect, useRef } from 'react';
import { Store, Swords, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@autix/shared-store';
import { useChatStore } from '@autix/shared-store';
import { useArtifactStore } from '@autix/shared-store';
import { useAIUIStore } from '@autix/shared-store';
import { useRouter, usePathname } from '../navigation';
import { useTheme } from '../theme';
import { useTaskStore } from '@autix/shared-store';
import { useUiStore } from '@autix/shared-store';
import { useLanguageStore } from '@autix/shared-store';
import { useTranslations } from 'next-intl';
import {
  ChatSidebarFooter,
  ChatSidebarHeader,
  ChatSidebarNavSection,
  ChatSidebarRecentControls,
  ChatSidebarRecentList,
  type KindKey,
} from './ChatSidebarParts';
import { ConversationDeleteDialog } from './ConversationDeleteDialog';

export interface SidebarNavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  active?: boolean;
  /** 自定义点击行为；提供时优先于 href 跳转 */
  action?: () => void;
}

export interface SidebarViewOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface ChatSidebarProps {
  customNavItems?: SidebarNavItem[];
  showRecentChats?: boolean;
  viewSwitcher?: {
    currentId: string;
    views: SidebarViewOption[];
    onSwitch: (id: string) => void;
  };
  brandLabel?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function ChatSidebar({
  customNavItems,
  showRecentChats = true,
  viewSwitcher,
  brandLabel = 'Amux Studio',
  collapsed = false,
  onToggleCollapsed,
}: ChatSidebarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const t = useTranslations('sidebar');
  const tc = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tChat = useTranslations('chat');
  const tKind = useTranslations('chat.agentKind');
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useChatStore();
  const clearArtifact = useArtifactStore((s) => s.clearArtifact);
  const resetAIUI = useAIUIStore((s) => s.reset);
  const { theme, setTheme } = useTheme();
  const unreadCount = useTaskStore((s) => s.events.filter((e) => !e.readAt).length);
  const openNotificationDrawer = useUiStore((s) => s.openNotificationDrawer);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const { language, setLanguage } = useLanguageStore();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [kindFilter, setKindFilter] = useState<KindKey | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const closeDeleteConfirm = () => setPendingDelete(null);
  const confirmDelete = () => {
    if (!pendingDelete) return;
    const wasActive = pendingDelete.id === activeSessionId;
    deleteSession(pendingDelete.id);
    if (wasActive) {
      clearArtifact();
      resetAIUI();
    }
    setPendingDelete(null);
  };

  const isArena = pathname.startsWith('/arena');
  const isMarketplace = pathname.startsWith('/marketplace') || pathname.startsWith('/community');
  const isChatRoute = pathname.startsWith('/c/') || pathname.startsWith('/chat');

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const filtered = sessions.filter((s) => {
    if (kindFilter) {
      const k = ((s as unknown as { kind?: KindKey }).kind ?? 'chat') as KindKey;
      if (k !== kindFilter) return false;
    }
    return s.title.toLowerCase().includes(search.toLowerCase());
  });

  const handleNewChat = async () => {
    const id = await createSession(tChat('newConversation'), { kind: 'chat' });
    setSearchOpen(false);
    setSearch('');
    router.push(`/c/${id}`);
  };

  const handleNewVideo = async () => {
    const id = await createSession(t('untitledVideoProject'), { kind: 'video' });
    setSearchOpen(false);
    setSearch('');
    router.push(`/c/${id}`);
  };

  const handleLogout = () => {
    logout();
    router.push('/community');
  };

  const displayName = (user as any)?.realName || (user as any)?.username || t('defaultUser');
  const displayEmail = (user as any)?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const kindLabel = (kind: KindKey) => tKind(kind);
  const projectStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return t('projectStatusDraft');
      case 'generating':
        return t('projectStatusGenerating');
      case 'completed':
        return t('projectStatusCompleted');
      case 'failed':
        return t('projectStatusFailed');
      default:
        return status;
    }
  };

  const defaultNavItems: SidebarNavItem[] = [
    { label: t('arena'), icon: Swords, href: '/arena', active: isArena },
    { label: t('marketplace'), icon: Store, href: '/community', active: isMarketplace },
  ];
  const navItems = customNavItems ?? defaultNavItems;
  const isAuthenticated = Boolean(user);

  return (
    <aside
      className={`flex h-full w-full flex-col shrink-0 bg-background border-r border-border ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-card border border-border">
        <ChatSidebarHeader
          collapsed={collapsed}
          brandLabel={brandLabel}
          collapseLabel={t('collapseMenu')}
          expandLabel={t('expandMenu')}
          onToggleCollapsed={onToggleCollapsed}
        />

        <ChatSidebarNavSection
          collapsed={collapsed}
          navItems={navItems}
          labels={{
            newSession: t('newSession'),
            chat: kindLabel('chat'),
            video: kindLabel('video'),
          }}
          onNewChat={handleNewChat}
          onNewVideo={handleNewVideo}
          onNavigate={(href, action) => {
            if (action) {
              action();
              return;
            }
            if (!isAuthenticated && href && href !== '/community') {
              openAuthModal({ mode: 'entry' });
              return;
            }
            router.push(href!);
          }}
        />

        {showRecentChats && !collapsed && (
          <ChatSidebarRecentControls
            searchOpen={searchOpen}
            search={search}
            searchRef={searchRef}
            kindFilter={kindFilter}
            labels={{
              recentChats: t('recentChats'),
              searchLabel: t('searchLabel'),
              searchPlaceholder: t('searchPlaceholder'),
              clearSearch: t('clearSearch'),
              all: tc('all'),
            }}
            kindLabel={kindLabel}
            onSearchOpenChange={setSearchOpen}
            onSearchChange={setSearch}
            onKindFilterChange={setKindFilter}
          />
        )}

        {showRecentChats && !collapsed && (
          <ChatSidebarRecentList
            sessions={filtered}
            activeSessionId={activeSessionId}
            isChatRoute={isChatRoute}
            search={search}
            labels={{
              deleteLabel: t('deleteLabel'),
              noMatchingConversation: tChat('noMatchingConversation'),
              noConversations: tChat('noConversations'),
            }}
            kindLabel={kindLabel}
            projectStatusLabel={projectStatusLabel}
            clipCountLabel={(count) => t('clipCount', { count })}
            onSelectSession={(id) => {
              setActiveSession(id);
              router.push(`/c/${id}`);
            }}
            onRequestDelete={setPendingDelete}
          />
        )}

        {(!showRecentChats || collapsed) && <div className="flex-1" />}

        <ChatSidebarFooter
          collapsed={collapsed}
          displayName={displayName}
          displayEmail={displayEmail}
          avatarLetter={avatarLetter}
          unreadCount={unreadCount}
          language={language}
          setLanguage={setLanguage}
          theme={theme}
          setTheme={setTheme}
          viewSwitcher={viewSwitcher}
          labels={{
            switchLanguage: t('switchLanguage'),
            profile: t('profile'),
            userMenu: t('userMenu'),
            notifications: t('notifications'),
            logout: tAuth('logout'),
            switchThemeLight: tc('switchThemeLight'),
            switchThemeDark: tc('switchThemeDark'),
          }}
          onProfile={() => router.push('/profile')}
          onNotifications={openNotificationDrawer}
          onLogout={handleLogout}
        />
      </div>

      {pendingDelete && (
        <ConversationDeleteDialog
          title={tChat('deleteConversationTitle')}
          message={tChat('deleteConversationMsg', {
            title: pendingDelete.title,
          })}
          cancelLabel={tc('cancel')}
          confirmLabel={tc('confirmDelete')}
          onCancel={closeDeleteConfirm}
          onConfirm={confirmDelete}
        />
      )}
    </aside>
  );
}
