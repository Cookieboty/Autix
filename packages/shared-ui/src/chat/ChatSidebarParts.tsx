'use client';

import {
  Bell,
  ChevronDown,
  Film,
  Languages,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
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
import type { ChatSidebarNavItemLike, ChatSidebarViewSwitcher } from './ChatSidebarTypes';

export { ChatSidebarRecentControls, ChatSidebarRecentList } from './ChatSidebarRecentParts';
export type { KindKey } from './ChatSidebarTypes';

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
