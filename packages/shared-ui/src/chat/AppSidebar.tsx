'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bookmark,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Coins,
  Crown,
  Gift,
  Languages,
  Laugh,
  LogOut,
  MessageSquare,
  Moon,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Sun,
  Swords,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

import { Image } from '../next-compat';
import { useRouter, usePathname } from '../navigation';
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
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  type SupportedLanguage,
} from '@autix/i18n';

import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '../ui/empty';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar';

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
  const unreadCount = useTaskStore(
    (s) => s.events.filter((e) => !e.readAt).length,
  );
  const openNotificationDrawer = useUiStore((s) => s.openNotificationDrawer);
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

  const isArena = pathname.startsWith('/arena');
  const isMarketplace = pathname.startsWith('/marketplace');
  const isChatRoute =
    pathname.startsWith('/c/') || pathname.startsWith('/chat');

  React.useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleNewChat = async () => {
    const id = await createSession(tChat('newConversation'));
    setSearchOpen(false);
    setSearch('');
    router.push(`/c/${id}`);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const userAny = user as
    | { realName?: string; username?: string; email?: string }
    | null;
  const displayName =
    userAny?.realName || userAny?.username || t('defaultUser');
  const displayEmail = userAny?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const defaultNavItems: AppSidebarNavItem[] = [
    {
      label: t('newSession'),
      icon: Plus,
      href: '/c/new',
      active: false,
      action: handleNewChat,
    },
    { label: t('arena'), icon: Swords, href: '/arena', active: isArena },
    {
      label: t('marketplace'),
      icon: Store,
      href: '/marketplace',
      active: isMarketplace,
    },
  ];
  const navItems = customNavItems ?? defaultNavItems;

  const isLibrary = pathname.startsWith('/library');
  const isModels = pathname.startsWith('/models');
  const isResources = pathname.startsWith('/resources');
  const isMembership = pathname.startsWith('/membership');
  const resourceTab = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('tab') ?? 'acquired'
    : 'acquired';

  const defaultNavGroups: AppSidebarNavGroup[] = [
    {
      label: t('tools'),
      defaultOpen: isLibrary || isModels,
      items: [
        { label: t('library'), icon: BookOpen, href: '/library', active: isLibrary },
        { label: t('modelConfig'), icon: Settings, href: '/models', active: isModels },
      ],
    },
    {
      label: t('myContent'),
      defaultOpen: isResources,
      items: [
        { label: t('myResources'), icon: Sparkles, href: '/resources?tab=acquired', active: isResources && resourceTab === 'acquired' },
        { label: t('myFavorites'), icon: Star, href: '/resources?tab=favorites', active: isResources && resourceTab === 'favorites' },
        { label: t('myPublished'), icon: Upload, href: '/resources?tab=published', active: isResources && resourceTab === 'published' },
        { label: t('generationHistory'), icon: Clock, href: '/resources?tab=generations', active: isResources && resourceTab === 'generations' },
        { label: t('browseHistory'), icon: Bookmark, href: '/resources?tab=history', active: isResources && resourceTab === 'history' },
      ],
    },
    {
      label: t('membership'),
      defaultOpen: isMembership,
      items: [
        { label: t('membershipOverview'), icon: Crown, href: '/membership/upgrade', active: pathname === '/membership/upgrade' },
        { label: t('pointsHistory'), icon: Coins, href: '/membership/points', active: pathname === '/membership/points' },
        { label: t('pointsPackages'), icon: Package, href: '/membership/packages', active: pathname === '/membership/packages' },
        { label: t('myOrders'), icon: ShoppingBag, href: '/membership/orders', active: pathname === '/membership/orders' },
        { label: t('inviteFriends'), icon: Gift, href: '/membership/invite', active: pathname === '/membership/invite' },
      ],
    },
  ];
  const navGroups = customNavItems ? undefined : (customNavGroups ?? defaultNavGroups);

  return (
    <>
      <Sidebar variant="inset" collapsible="icon" {...sidebarProps}>
        <SidebarHeader className="group-data-[collapsible=icon]:p-1.5">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                asChild
                className="group-data-[collapsible=icon]:justify-center"
              >
                <a
                  href="/chat"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push('/chat');
                  }}
                >
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                    <Image
                      src="/logo.png"
                      alt={brandLabel}
                      width={32}
                      height={32}
                      style={{ width: 32, height: 32 }}
                    />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{brandLabel}</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="group-data-[collapsible=icon]:gap-1">
          <SidebarGroup className="group-data-[collapsible=icon]:p-1.5">
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ label, icon: Icon, href, active, action }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      tooltip={label}
                      isActive={active}
                      onClick={() => {
                        if (action) action();
                        else if (href) router.push(href);
                      }}
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      <Icon />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {navGroups && navGroups.map((group) => (
            <Collapsible
              key={group.label}
              defaultOpen={group.defaultOpen}
              className="group/collapsible"
            >
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center">
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map(({ label, icon: Icon, href, active, action }) => (
                        <SidebarMenuItem key={label}>
                          <SidebarMenuButton
                            tooltip={label}
                            isActive={active}
                            onClick={() => {
                              if (action) action();
                              else if (href) router.push(href);
                            }}
                          >
                            <Icon className="size-4" />
                            <span>{label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ))}

          {showRecentChats && (
            <SidebarGroup className="group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:p-1.5">
              {searchOpen ? (
                <div className="mb-1 flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setSearch('');
                          setSearchOpen(false);
                        }
                      }}
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    className="shrink-0 px-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSearch('');
                      setSearchOpen(false);
                    }}
                  >
                    {tc('cancel')}
                  </button>
                </div>
              ) : (
                <>
                  <SidebarGroupLabel className="text-muted-foreground">
                    {t('recentChats')}
                  </SidebarGroupLabel>
                  <SidebarGroupAction
                    title={t('searchLabel')}
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search />
                    <span className="sr-only">{t('searchLabel')}</span>
                  </SidebarGroupAction>
                </>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {filtered.length > 0 ? (
                    filtered.map((session) => {
                      const isActive =
                        isChatRoute && activeSessionId === session.id;
                      return (
                        <SidebarMenuItem key={session.id}>
                          <SidebarMenuButton
                            tooltip={session.title}
                            isActive={isActive}
                            onClick={() => {
                              setActiveSession(session.id);
                              router.push(`/c/${session.id}`);
                            }}
                          >
                            <MessageSquare />
                            <span>{session.title}</span>
                          </SidebarMenuButton>
                          <SidebarMenuAction
                            showOnHover
                            aria-label={t('deleteLabel')}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDelete({
                                id: session.id,
                                title: session.title,
                              });
                            }}
                          >
                            <Trash2 />
                          </SidebarMenuAction>
                        </SidebarMenuItem>
                      );
                    })
                  ) : (
                    <Empty className="gap-3 border-0 px-2 py-6 md:p-6">
                      <EmptyHeader className="gap-1.5">
                        <EmptyMedia variant="icon" className="mb-1 size-9 text-muted-foreground [&_svg:not([class*='size-'])]:size-5">
                          <Laugh aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyDescription>
                          {search
                            ? tChat('noMatchingConversation')
                            : tChat('noConversations')}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="group-data-[collapsible=icon]:p-1.5">
          <SidebarMenu>
            <SidebarMenuItem>
              <NavUser
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
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {pendingDelete && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeDeleteConfirm();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                {tChat('deleteConversationTitle')}
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-muted-foreground">
                {tChat('deleteConversationMsg', { title: pendingDelete.title })}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={closeDeleteConfirm}>
                {tc('cancel')}
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                {tc('confirmDelete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

interface NavUserProps {
  displayName: string;
  displayEmail: string;
  avatarLetter: string;
  unreadCount: number;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  theme: string | undefined;
  setTheme: (t: string) => void;
  onProfile: () => void;
  onNotifications: () => void;
  onDocs: () => void;
  onLogout: () => void;
  viewSwitcher?: AppSidebarProps['viewSwitcher'];
  labels: {
    profile: string;
    notifications: string;
    docs: string;
    switchLanguage: string;
    userMenu: string;
    switchThemeLight: string;
    switchThemeDark: string;
    logout: string;
  };
}

function NavUser({
  displayName,
  displayEmail,
  avatarLetter,
  unreadCount,
  language,
  setLanguage,
  theme,
  setTheme,
  onProfile,
  onNotifications,
  onDocs,
  onLogout,
  viewSwitcher,
  labels,
}: NavUserProps) {
  const { isMobile } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          aria-label={labels.userMenu}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
        >
          <Avatar className="h-8 w-8 shrink-0 rounded-lg">
            <AvatarFallback className="rounded-lg">
              {avatarLetter}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">{displayName}</span>
            {displayEmail && (
              <span className="truncate text-xs text-muted-foreground">
                {displayEmail}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        side={isMobile ? 'bottom' : 'right'}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg">
                {avatarLetter}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{displayName}</span>
              {displayEmail && (
                <span className="truncate text-xs text-muted-foreground">
                  {displayEmail}
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {viewSwitcher && viewSwitcher.views.length > 0 && (
          <>
            <DropdownMenuGroup>
              {viewSwitcher.views.map((view) => {
                const Icon = view.icon;
                const isCurrent = view.id === viewSwitcher.currentId;
                return (
                  <DropdownMenuItem
                    key={`view-${view.id}`}
                    onClick={() => viewSwitcher.onSwitch(view.id)}
                  >
                    <Icon />
                    <span className="flex-1">{view.label}</span>
                    {isCurrent && <span className="text-xs">✓</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Languages />
              <span className="flex-1">{labels.switchLanguage}</span>
              <span className="text-xs text-muted-foreground">==
                {LANGUAGE_LABELS[language]}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang}
                  onClick={() => setLanguage(lang)}
                >
                  <span className={lang === language ? 'font-medium' : ''}>
                    {LANGUAGE_LABELS[lang]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={onNotifications}>
            <Bell />
            <span className="flex-1">{labels.notifications}</span>
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDocs}>
            <BookOpen />
            <span>{labels.docs}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
            <span>
              {theme === 'dark'
                ? labels.switchThemeLight
                : labels.switchThemeDark}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onProfile}>
            <Avatar className="size-4 rounded-full">
              <AvatarFallback className="rounded-full text-[8px]">
                {avatarLetter}
              </AvatarFallback>
            </Avatar>
            <span>{labels.profile}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut />
          <span>{labels.logout}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
