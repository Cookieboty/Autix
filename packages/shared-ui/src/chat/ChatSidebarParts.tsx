'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  ChevronDown,
  Film,
  Image as ImageIcon,
  Languages,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react';

import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@autix/i18n';

import { ThemeLogo } from '../brand';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export type KindKey = 'chat' | 'video' | 'image' | 'avatar';

interface ChatSidebarViewSwitcher {
  currentId: string;
  views: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
  }>;
  onSwitch: (id: string) => void;
}

interface ChatSidebarNavItemLike {
  label: string;
  icon: LucideIcon;
  href?: string;
  active?: boolean;
  action?: () => void;
}

interface ChatSidebarSessionListItem {
  id: string;
  title: string;
  kind?: KindKey;
  agentName?: string | null;
  projectMeta?: {
    projectId: string;
    status: string;
    clipCount: number;
  } | null;
}

function KindBadge({ kind, label }: { kind: KindKey; label: string }) {
  const Icon =
    kind === 'video'
      ? Film
      : kind === 'image'
        ? ImageIcon
        : MessageSquare;
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-secondary"
      aria-label={label}
      title={label}
    >
      <Icon className="h-3 w-3 text-muted-foreground" />
    </span>
  );
}

export function ChatSidebarHeader({
  collapsed,
  brandLabel,
  collapseLabel,
  expandLabel,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  brandLabel: string;
  collapseLabel: string;
  expandLabel: string;
  onToggleCollapsed?: () => void;
}) {
  return (
    <div className={`${collapsed ? 'px-2' : 'px-4'} pt-5 pb-4 shrink-0`}>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        {!collapsed && <ThemeLogo alt={brandLabel} size={30} />}
        {!collapsed && (
          <div className="min-w-0">
            <p
              className="text-[15px] font-semibold tracking-tight truncate text-foreground"
              title={brandLabel}
            >
              {brandLabel}
            </p>
          </div>
        )}
        {onToggleCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            className={`${collapsed ? '' : 'ml-auto'} cursor-pointer p-0 min-w-8 h-8 rounded-md`}
            onClick={onToggleCollapsed}
            aria-label={collapsed ? expandLabel : collapseLabel}
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
  );
}

export function ChatSidebarNavSection({
  collapsed,
  navItems,
  labels,
  onNewChat,
  onNewVideo,
  onNavigate,
}: {
  collapsed: boolean;
  navItems: ChatSidebarNavItemLike[];
  labels: {
    newSession: string;
    chat: string;
    video: string;
  };
  onNewChat: () => void;
  onNewVideo: () => void;
  onNavigate: (href?: string, action?: () => void) => void;
}) {
  return (
    <div className="px-2 pb-2 shrink-0 space-y-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full min-w-0 ${collapsed ? 'justify-center px-0' : 'justify-start px-3.5'} h-11 rounded-md text-sm font-medium cursor-pointer transition-colors text-foreground bg-transparent`}
          >
            <Plus className={`w-4 h-4 shrink-0 ${collapsed ? '' : 'mr-2.5'} text-muted-foreground`} />
            {!collapsed && (
              <span className="min-w-0 flex-1 truncate text-left">
                {labels.newSession}
              </span>
            )}
            {!collapsed && (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem onClick={onNewChat}>
            <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
            {labels.chat}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNewVideo}>
            <Film className="h-4 w-4 mr-2 text-muted-foreground" />
            {labels.video}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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

        return (
          <Button
            key={label}
            variant="ghost"
            className={className}
            onClick={() => onNavigate(href, action)}
          >
            {icon}
            {!collapsed && labelNode}
          </Button>
        );
      })}
    </div>
  );
}

export function ChatSidebarRecentControls({
  searchOpen,
  search,
  searchRef,
  kindFilter,
  labels,
  kindLabel,
  onSearchOpenChange,
  onSearchChange,
  onKindFilterChange,
}: {
  searchOpen: boolean;
  search: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  kindFilter: KindKey | null;
  labels: {
    recentChats: string;
    searchLabel: string;
    searchPlaceholder: string;
    clearSearch: string;
    all: string;
  };
  kindLabel: (kind: KindKey) => string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onKindFilterChange: (kind: KindKey | null) => void;
}) {
  return (
    <div className="px-3 pt-3 pb-2 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {labels.recentChats}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className={`cursor-pointer p-0 min-w-8 h-8 rounded-md ${searchOpen ? 'bg-secondary' : 'bg-transparent'}`}
          onClick={() => onSearchOpenChange(!searchOpen)}
          aria-label={labels.searchLabel}
        >
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </div>

      {searchOpen && (
        <div className="relative mb-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={labels.searchPlaceholder}
            className="w-full h-10 pl-9 pr-9 text-sm rounded-md outline-none bg-background text-foreground border border-input"
            onKeyDown={(event) => {
              if (event.key === 'Escape') onSearchOpenChange(false);
            }}
          />
          {search && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer p-0 min-w-7 h-7 rounded-md"
              aria-label={labels.clearSearch}
              onClick={() => {
                onSearchChange('');
                onSearchOpenChange(false);
              }}
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      )}

      <div className="mt-1 flex items-center gap-1 overflow-x-auto">
        <Button
          variant={kindFilter === null ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-[11px] rounded-md cursor-pointer shrink-0"
          onClick={() => onKindFilterChange(null)}
        >
          {labels.all}
        </Button>
        <Button
          variant={kindFilter === 'chat' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-[11px] rounded-md cursor-pointer shrink-0"
          onClick={() => onKindFilterChange('chat')}
        >
          <MessageSquare className="w-3 h-3 mr-1" />
          {kindLabel('chat')}
        </Button>
        <Button
          variant={kindFilter === 'video' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-[11px] rounded-md cursor-pointer shrink-0"
          onClick={() => onKindFilterChange('video')}
        >
          <Film className="w-3 h-3 mr-1" />
          {kindLabel('video')}
        </Button>
      </div>
    </div>
  );
}

export function ChatSidebarRecentList({
  sessions,
  activeSessionId,
  isChatRoute,
  search,
  labels,
  kindLabel,
  projectStatusLabel,
  clipCountLabel,
  onSelectSession,
  onRequestDelete,
}: {
  sessions: ChatSidebarSessionListItem[];
  activeSessionId: string | null | undefined;
  isChatRoute: boolean;
  search: string;
  labels: {
    deleteLabel: string;
    noMatchingConversation: string;
    noConversations: string;
  };
  kindLabel: (kind: KindKey) => string;
  projectStatusLabel: (status: string) => string;
  clipCountLabel: (count: number) => string;
  onSelectSession: (id: string) => void;
  onRequestDelete: (session: { id: string; title: string }) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5">
      {sessions.length > 0 ? (
        sessions.map((session) => {
          const isActive = isChatRoute && activeSessionId === session.id;
          const sessionKind: KindKey = session.kind ?? 'chat';
          return (
            <div key={session.id} className="flex min-w-0 items-center gap-1 group">
              <Button
                variant="ghost"
                className={`min-w-0 flex-1 justify-start h-auto min-h-11 px-3 py-2.5 text-xs rounded-md cursor-pointer ${isActive ? 'bg-accent text-foreground' : 'bg-transparent text-muted-foreground'
                  }`}
                onClick={() => onSelectSession(session.id)}
              >
                <KindBadge kind={sessionKind} label={kindLabel(sessionKind)} />
                <div className="ml-2 min-w-0 flex-1">
                  <div
                    className={`truncate text-left leading-5 ${isActive ? 'text-foreground' : ''}`}
                    title={session.title}
                  >
                    {session.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {session.agentName ? (
                      <span className="truncate" title={session.agentName}>
                        {session.agentName}
                      </span>
                    ) : (
                      <span>{kindLabel(sessionKind)}</span>
                    )}
                    {session.projectMeta && (
                      <>
                        <span>·</span>
                        <span>{projectStatusLabel(session.projectMeta.status)}</span>
                        <span>·</span>
                        <span>{clipCountLabel(session.projectMeta.clipCount)}</span>
                      </>
                    )}
                  </div>
                </div>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer p-0 opacity-0 group-hover:opacity-100 min-w-7 h-7 rounded-md shrink-0"
                onClick={() => onRequestDelete(session)}
                aria-label={labels.deleteLabel}
              >
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          );
        })
      ) : (
        <div className="px-3 py-8 text-center rounded-md bg-secondary">
          <p className="text-xs text-muted-foreground">
            {search ? labels.noMatchingConversation : labels.noConversations}
          </p>
        </div>
      )}
    </div>
  );
}

export function ChatSidebarFooter({
  collapsed,
  displayName,
  displayEmail,
  avatarLetter,
  unreadCount,
  language,
  setLanguage,
  theme,
  setTheme,
  viewSwitcher,
  labels,
  onProfile,
  onNotifications,
  onLogout,
}: {
  collapsed: boolean;
  displayName: string;
  displayEmail: string;
  avatarLetter: string;
  unreadCount: number;
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  theme: string | undefined;
  setTheme: (theme: string) => void;
  viewSwitcher?: ChatSidebarViewSwitcher;
  labels: {
    switchLanguage: string;
    profile: string;
    userMenu: string;
    notifications: string;
    logout: string;
    switchThemeLight: string;
    switchThemeDark: string;
  };
  onProfile: () => void;
  onNotifications: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="shrink-0 px-3 py-3 border-t border-border">
      <div className="flex items-center gap-1 mb-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent cursor-pointer"
            aria-label={labels.switchLanguage}
          >
            <Languages className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[160px]">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <DropdownMenuItem key={lang} onClick={() => setLanguage(lang)}>
                <span className={lang === language ? 'font-medium' : ''}>
                  {LANGUAGE_LABELS[lang]}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {!collapsed && (
          <span className="text-[11px] flex-1 text-muted-foreground">
            {LANGUAGE_LABELS[language]}
          </span>
        )}
      </div>
      <div className={`flex w-full min-w-0 items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
        <button
          type="button"
          className={`flex min-w-0 flex-1 cursor-pointer items-center ${collapsed ? 'justify-center px-0' : 'gap-2 px-2'} rounded-md py-1.5 text-left bg-transparent hover:bg-accent`}
          onClick={onProfile}
          aria-label={labels.profile}
          title={labels.profile}
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
          {!collapsed && (
            <div className="min-w-0 flex-1">
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
            </div>
          )}
        </button>
        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-transparent hover:bg-accent"
              aria-label={labels.userMenu}
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
                          {isCurrent && (
                            <span className="text-xs text-primary">✓</span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              ) : null}
              <DropdownMenuItem onClick={onNotifications}>
                <div className="flex w-full items-center gap-2">
                  <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm">{labels.notifications}</span>
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
                    {theme === 'dark'
                      ? labels.switchThemeLight
                      : labels.switchThemeDark}
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout}>
                <div className="flex w-full items-center gap-2 text-destructive">
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-sm">{labels.logout}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
