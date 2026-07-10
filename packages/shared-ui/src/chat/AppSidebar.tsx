'use client';

import * as React from 'react';
import {
  BookOpen,
  Coins,
  Gift,
  Images,
  ImageIcon,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../theme';
import { useTranslations } from 'next-intl';

import { useChatEnabled, useLibraryEnabled } from '../hooks/useModelConfigEnabled';
import { usePathname, useRouter, useSearchParams } from '../navigation';
import {
  useAuthStore,
  useChatStore,
  useArtifactStore,
  useAIUIStore,
  useTaskStore,
  useUiStore,
  useLanguageStore,
} from '@autix/shared-store';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from '../ui/sidebar';
import {
  AppSidebarHeader,
  AppSidebarNavGroups,
  AppSidebarNavItemsSection,
} from './AppSidebarNavigation';
import { AppSidebarRecentChats } from './AppSidebarRecentChats';
import {
  AppSidebarGuestUserButton,
  AppSidebarUserMenu,
} from './AppSidebarUserMenu';
import { ConversationDeleteDialog } from './ConversationDeleteDialog';

export interface AppSidebarNavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  active?: boolean;
  /** 自定义点击行为；提供时优先于 href 跳转 */
  action?: () => void;
}

export interface AppSidebarNavGroup {
  label: string;
  items: AppSidebarNavItem[];
  defaultOpen?: boolean;
}

export interface AppSidebarViewOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface AppSidebarProps
  extends Omit<React.ComponentProps<typeof Sidebar>, 'children'> {
  customNavItems?: AppSidebarNavItem[];
  navGroups?: AppSidebarNavGroup[];
  showRecentChats?: boolean;
  viewSwitcher?: {
    currentId: string;
    views: AppSidebarViewOption[];
    onSwitch: (id: string) => void;
  };
  brandLabel?: string;
}

function normalizePathname(pathname: string): string {
  const clean = pathname.split('?')[0]?.replace(/\/+$/, '') || '/';
  return clean === '' ? '/' : clean;
}

export function AppSidebar({
  customNavItems,
  navGroups: customNavGroups,
  showRecentChats = true,
  viewSwitcher,
  brandLabel = 'Amux Studio',
  ...sidebarProps
}: AppSidebarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const t = useTranslations('sidebar');
  const tc = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tChat = useTranslations('chat');

  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const clearArtifact = useArtifactStore((s) => s.clearArtifact);
  const resetAIUI = useAIUIStore((s) => s.reset);
  const { theme, setTheme } = useTheme();
  const chatEnabled = useChatEnabled(false);
  const libraryEnabled = useLibraryEnabled(false);
  const unreadCount = useTaskStore(
    (s) => s.events.filter((e) => !e.readAt).length,
  );
  const openNotificationDrawer = useUiStore((s) => s.openNotificationDrawer);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const [search, setSearch] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

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

  const normalizedPathname = normalizePathname(pathname);
  // 练武场/资源市场/绘制 菜单暂时隐藏（/draw 页面已注释），保留 active 判定以便日后恢复
  // const isArena = normalizedPathname.startsWith('/arena');
  // const isMarketplace =
  //   normalizedPathname.startsWith('/marketplace') ||
  //   normalizedPathname.startsWith('/community');
  const isChatRoute =
    normalizedPathname.startsWith('/c/') || normalizedPathname.startsWith('/chat');
  const isAuthenticated = Boolean(user);

  React.useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const handleNewChat = async () => {
    const id = await createSession(tChat('newConversation'));
    setSearchOpen(false);
    setSearch('');
    router.push(`/c/${id}`);
  };

  const handleLogout = () => {
    logout();
    router.push('/community');
  };

  const userAny = user as
    | { realName?: string; username?: string; email?: string }
    | null;
  const displayName =
    userAny?.realName || userAny?.username || t('defaultUser');
  const displayEmail = userAny?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const isLibrary = normalizedPathname.startsWith('/library');
  const isResources = normalizedPathname.startsWith('/resources');
  const isMembership = normalizedPathname.startsWith('/membership');
  const isMaterials = normalizedPathname.startsWith('/materials');
  // const isDraw = normalizedPathname === '/draw';
  const publicHrefs = React.useMemo(
    () => new Set(['/community', '/marketplace/image-templates', '/marketplace/video-templates', '/docs']),
    [],
  );
  const requestLogin = React.useCallback(() => {
    openAuthModal({ mode: 'entry' });
  }, [openAuthModal]);

  const defaultNavItems: AppSidebarNavItem[] = [
    ...(chatEnabled
      ? [
          {
            label: t('newSession'),
            icon: Plus,
            href: '/c/new',
            active: false,
            action: isAuthenticated ? handleNewChat : () => requestLogin(),
          },
          // 练武场菜单暂时隐藏
          // { label: t('arena'), icon: Swords, href: '/arena', active: isArena },
        ]
      : []),
    // 资源市场菜单暂时隐藏
    // {
    //   label: t('marketplace'),
    //   icon: Store,
    //   href: '/community',
    //   active: isMarketplace,
    // },
    {
      label: t('imageWorkbench'),
      icon: ImageIcon,
      href: '/workbench/image',
      active: normalizedPathname === '/workbench/image',
    },
    // 绘制菜单暂时隐藏（/draw 页面已注释）
    // {
    //   label: t('drawWorkspace'),
    //   icon: Brush,
    //   href: '/draw',
    //   active: isDraw,
    // },
    {
      label: t('videoWorkbench'),
      icon: Video,
      href: '/workbench/video',
      active: normalizedPathname === '/workbench/video',
    },
    {
      label: t('materialLibrary'),
      icon: Images,
      href: '/materials',
      active: isMaterials,
    },
    {
      label: t('myContent'),
      icon: BookOpen,
      href: '/resources?tab=acquired',
      active: isResources,
    },
  ];
  const navItems = customNavItems ?? defaultNavItems;
  const navigateFromSidebar = (href?: string, action?: () => void) => {
    if (action) {
      action();
      return;
    }
    if (!href) return;
    if (!isAuthenticated && !publicHrefs.has(href)) {
      requestLogin();
      return;
    }
    router.push(href);
  };

  const getSidebarHref = React.useCallback(
    (href?: string) => {
      if (!href) return undefined;
      if (!isAuthenticated && !publicHrefs.has(href.split('?')[0] ?? href)) return undefined;
      return href;
    },
    [isAuthenticated, publicHrefs],
  );
  const defaultNavGroups: AppSidebarNavGroup[] = [
    {
      label: t('tools'),
      defaultOpen: libraryEnabled && isLibrary,
      items: [
        ...(libraryEnabled
          ? [{ label: t('library'), icon: BookOpen, href: '/library', active: isLibrary }]
          : []),
      ],
    },
    {
      label: t('membership'),
      defaultOpen: isMembership,
      items: [
        { label: t('membershipOverview'), icon: ShieldCheck, href: '/membership/benefits', active: normalizedPathname === '/membership/benefits' || normalizedPathname === '/membership/upgrade' },
        { label: t('pointsHistory'), icon: Coins, href: '/membership/points', active: normalizedPathname === '/membership/points' },
        { label: t('rewardsCenter'), icon: Trophy, href: '/membership/rewards', active: normalizedPathname === '/membership/rewards' },
        { label: t('myOrders'), icon: ShoppingBag, href: '/membership/orders', active: normalizedPathname === '/membership/orders' },
        { label: t('inviteFriends'), icon: Gift, href: '/membership/invite', active: normalizedPathname === '/membership/invite' },
      ],
    },
  ];
  const navGroups = customNavItems
    ? undefined
    : (customNavGroups ?? defaultNavGroups).filter((group) => group.items.length > 0);

  return (
    <>
      <Sidebar variant="inset" collapsible="icon" {...sidebarProps}>
        <AppSidebarHeader
          brandLabel={brandLabel}
          homeHref={chatEnabled ? '/chat' : '/community'}
          collapseLabel={t('collapseSidebar')}
          expandLabel={t('expandSidebar')}
          onNavigateHome={() => router.push(chatEnabled ? '/chat' : '/community')}
        />

        <SidebarContent className="group-data-[collapsible=icon]:gap-1">
          <AppSidebarNavItemsSection
            navItems={navItems}
            getSidebarHref={getSidebarHref}
            navigateFromSidebar={navigateFromSidebar}
          />

          <AppSidebarNavGroups
            navGroups={navGroups}
            getSidebarHref={getSidebarHref}
            navigateFromSidebar={navigateFromSidebar}
          />

          {showRecentChats && chatEnabled && (
            <AppSidebarRecentChats
              sessions={sessions}
              activeSessionId={activeSessionId}
              isChatRoute={isChatRoute}
              search={search}
              searchOpen={searchOpen}
              searchRef={searchRef}
              labels={{
                recentChats: t('recentChats'),
                searchLabel: t('searchLabel'),
                searchPlaceholder: t('searchPlaceholder'),
                cancel: tc('cancel'),
                deleteLabel: t('deleteLabel'),
                noMatchingConversation: tChat('noMatchingConversation'),
                noConversations: tChat('noConversations'),
              }}
              onSearchChange={setSearch}
              onSearchOpenChange={setSearchOpen}
              onSelectSession={(id) => {
                setActiveSession(id);
                router.push(`/c/${id}`);
              }}
              onRequestDelete={(session) => setPendingDelete(session)}
            />
          )}
        </SidebarContent>

        <SidebarFooter className="group-data-[collapsible=icon]:p-1.5">
          <SidebarMenu>
            <SidebarMenuItem>
              {isAuthenticated ? (
                <AppSidebarUserMenu
                  displayName={displayName}
                  displayEmail={displayEmail}
                  avatarLetter={avatarLetter}
                  unreadCount={unreadCount}
                  language={language}
                  setLanguage={setLanguage}
                  theme={theme}
                  setTheme={setTheme}
                  onProfile={() => router.push('/profile')}
                  onNotifications={openNotificationDrawer}
                  onDocs={() => router.push('/docs')}
                  onLogout={handleLogout}
                  viewSwitcher={viewSwitcher}
                  labels={{
                    profile: t('profile'),
                    notifications: t('notifications'),
                    docs: t('docs'),
                    switchLanguage: t('switchLanguage'),
                    userMenu: t('userMenu'),
                    switchThemeLight: tc('switchThemeLight'),
                    switchThemeDark: tc('switchThemeDark'),
                    logout: tAuth('logout'),
                  }}
                />
              ) : (
                <AppSidebarGuestUserButton
                  loginLabel={tAuth('login')}
                  loginHint={t('loginResourceHint')}
                  onLogin={() => requestLogin()}
                />
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

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
    </>
  );
}
