'use client';

import { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Image } from '../next-compat';
import { useAuthStore } from '@autix/shared-store';
import { useChatStore } from '@autix/shared-store';
import { useArtifactStore } from '@autix/shared-store';
import { useAIUIStore } from '@autix/shared-store';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  LogOut,
  Sun,
  Moon,
  X,
  Settings,
  Bell,
  MoreHorizontal,
  AlertTriangle,
  Swords,
  Store,
  Languages,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useRouter, usePathname } from '../navigation';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuGroup } from '../ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../ui/dialog';
import { useTaskStore } from '@autix/shared-store';
import { useUiStore } from '@autix/shared-store';
import { useLanguageStore } from '@autix/shared-store';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '@autix/i18n';
import { useTranslations } from 'next-intl';

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
  const { user, logout, isAdmin } = useAuthStore();
  const t = useTranslations('sidebar');
  const tc = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tChat = useTranslations('chat');
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useChatStore();
  const clearArtifact = useArtifactStore((s) => s.clearArtifact);
  const resetAIUI = useAIUIStore((s) => s.reset);
  const { theme, setTheme } = useTheme();
  const unreadCount = useTaskStore((s) => s.events.filter((e) => !e.readAt).length);
  const openNotificationDrawer = useUiStore((s) => s.openNotificationDrawer);
  const { language, setLanguage } = useLanguageStore();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
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
  const isMarketplace = pathname.startsWith('/marketplace');
  const isChatRoute = pathname.startsWith('/c/') || pathname.startsWith('/chat');

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
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

  const displayName = (user as any)?.realName || (user as any)?.username || t('defaultUser');
  const displayEmail = (user as any)?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const defaultNavItems: SidebarNavItem[] = [
    { label: t('newSession'), icon: Plus, href: '/c/new', active: false, action: handleNewChat },
    { label: t('arena'), icon: Swords, href: '/arena', active: isArena },
    { label: t('marketplace'), icon: Store, href: '/marketplace', active: isMarketplace },
  ];
  const navItems = customNavItems ?? defaultNavItems;

  return (
    <aside
      className={`flex h-full w-full flex-col shrink-0 bg-background border-r border-border ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-card border border-border">
        <div className={`${collapsed ? 'px-2' : 'px-4'} pt-5 pb-4 shrink-0`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            {!collapsed && <Image
              src="/logo.png"
              alt={brandLabel}
              width={30}
              height={30}
              style={{ width: 30, height: 30 }}
              className="rounded-md shrink-0"
            />}
            {!collapsed && <div className="min-w-0">
              <p
                className="text-[15px] font-semibold tracking-tight truncate text-foreground"
                title={brandLabel}
              >
                {brandLabel}
              </p>
            </div>}
            {onToggleCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                className={`${collapsed ? '' : 'ml-auto'} cursor-pointer p-0 min-w-8 h-8 rounded-md`}
                onClick={onToggleCollapsed}
                aria-label={collapsed ? '展开菜单' : '收起菜单'}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="px-2 pb-2 shrink-0 space-y-1">
          {navItems.map(({ label, icon: Icon, href, active, action }) => {
            const className = `w-full min-w-0 ${collapsed ? 'justify-center px-0' : 'justify-start px-3.5'} h-11 rounded-md text-sm font-medium cursor-pointer transition-colors text-foreground ${active ? 'bg-accent' : 'bg-transparent'}`;

            const icon = (
              <Icon
                className={`w-4 h-4 shrink-0 ${collapsed ? '' : 'mr-2.5'} ${active ? 'text-foreground' : 'text-muted-foreground'}`}
              />
            );

            const labelNode = (
              <span className="min-w-0 flex-1 truncate text-left" title={label}>
                {label}
              </span>
            );

            if (action) {
              return (
                <Button key={label} variant="ghost" className={className} onClick={action}>
                  {icon}
                  {!collapsed && labelNode}
                </Button>
              );
            }

            return (
              <Button key={label} variant="ghost" className={className} onClick={() => router.push(href!)}>
                {icon}
                {!collapsed && labelNode}
              </Button>
            );
          })}
        </div>

        {showRecentChats && !collapsed && <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {t('recentChats')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={`cursor-pointer p-0 min-w-8 h-8 rounded-md ${searchOpen ? 'bg-secondary' : 'bg-transparent'}`}
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t('searchLabel')}
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>

          {searchOpen && (
            <div className="relative mb-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
              <input
                ref={searchRef as any}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full h-10 pl-9 pr-9 text-sm rounded-md outline-none bg-background text-foreground border border-input"
                onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
              />
              {search && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer p-0 min-w-7 h-7 rounded-md"
                  aria-label={t('clearSearch')}
                  onClick={() => {
                    setSearch('');
                    setSearchOpen(false);
                  }}
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          )}
        </div>}

        {showRecentChats && !collapsed && <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5">
          {filtered.length > 0 ? (
            filtered.map((session) => {
              const isActive = isChatRoute && activeSessionId === session.id;
              return (
                <div key={session.id} className="flex min-w-0 items-center gap-1 group">
                  <Button
                    variant="ghost"
                    className={`min-w-0 flex-1 justify-start h-auto min-h-11 px-3 py-2.5 text-xs rounded-md cursor-pointer ${
                      isActive ? 'bg-accent text-foreground' : 'bg-transparent text-muted-foreground'
                    }`}
                    onClick={() => {
                      setActiveSession(session.id);
                      router.push(`/c/${session.id}`);
                    }}
                  >
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 mr-2.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
                    />
                    <span
                      className="min-w-0 flex-1 truncate text-left leading-5"
                      title={session.title}
                    >
                      {session.title}
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer p-0 opacity-0 group-hover:opacity-100 min-w-7 h-7 rounded-md shrink-0"
                    onClick={() => setPendingDelete({ id: session.id, title: session.title })}
                    aria-label={t('deleteLabel')}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-8 text-center rounded-md bg-secondary">
              <p className="text-xs text-muted-foreground">
                {search ? tChat('noMatchingConversation') : tChat('noConversations')}
              </p>
            </div>
          )}
        </div>}

        {(!showRecentChats || collapsed) && <div className="flex-1" />}

        <div className="shrink-0 px-3 py-3 border-t border-border">
          <div className="flex items-center gap-1 mb-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent cursor-pointer"
                aria-label={t('switchLanguage')}
              >
                <Languages className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-[160px]">
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
              </DropdownMenuContent>
            </DropdownMenu>
            {!collapsed && <span className="text-[11px] flex-1 text-muted-foreground">{LANGUAGE_LABELS[language]}</span>}
          </div>
          <div className={`flex w-full min-w-0 items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
            <button
              type="button"
              className={`flex min-w-0 flex-1 cursor-pointer items-center ${collapsed ? 'justify-center px-0' : 'gap-2 px-2'} rounded-md py-1.5 text-left bg-transparent hover:bg-accent`}
              onClick={() => router.push('/profile')}
              aria-label={t('profile')}
              title={t('profile')}
            >
              <span className="relative shrink-0">
                <Avatar className="h-8 w-8 bg-secondary text-foreground">
                  <AvatarFallback className="bg-secondary text-foreground">
                    {avatarLetter}
                  </AvatarFallback>
                </Avatar>
                {unreadCount > 0 && (
                  <span
                    className="absolute right-0 top-0 block h-2 w-2 rounded-full bg-destructive ring-2 ring-card"
                    aria-hidden
                  />
                )}
              </span>
              {!collapsed && <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-medium leading-[1.2] text-foreground"
                  title={displayName}
                >
                  {displayName}
                </p>
                {displayEmail && (
                  <p
                    className="mt-0.5 truncate text-[11px] leading-[1.2] text-muted-foreground"
                    title={displayEmail}
                  >
                    {displayEmail}
                  </p>
                )}
              </div>}
            </button>
          {!collapsed && <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-transparent hover:bg-accent"
              aria-label={t('userMenu')}
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-[240px]">
              {viewSwitcher && viewSwitcher.views.length > 0 ? (
                <DropdownMenuGroup>
                  {viewSwitcher.views.map((view) => {
                    const Icon = view.icon;
                    const isCurrent = view.id === viewSwitcher.currentId;
                    return (
                      <DropdownMenuItem
                        key={`view-${view.id}`}
                        onClick={() => viewSwitcher.onSwitch(view.id)}
                      >
                        <div className="flex w-full items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 text-sm">{view.label}</span>
                          {isCurrent && <span className="text-xs text-primary">✓</span>}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              ) : null}
              <DropdownMenuItem onClick={openNotificationDrawer}>
                <div className="flex w-full items-center gap-2">
                  <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm">{t('notifications')}</span>
                  {unreadCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <div className="flex w-full items-center gap-2">
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 text-sm">
                    {theme === 'dark' ? tc('switchThemeLight') : tc('switchThemeDark')}
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <div className="flex w-full items-center gap-2 text-destructive">
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-sm">{tAuth('logout')}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
          </div>
        </div>
      </div>

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
    </aside>
  );
}
