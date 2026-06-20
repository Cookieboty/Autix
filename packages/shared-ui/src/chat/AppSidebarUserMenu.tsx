'use client';

import {
  Bell,
  BookOpen,
  ChevronsUpDown,
  Languages,
  LogOut,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';

import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@autix/i18n';

import { Avatar, AvatarFallback } from '../ui/avatar';
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
import { SidebarMenuButton, useSidebar } from '../ui/sidebar';

interface AppSidebarUserMenuViewSwitcher {
  currentId: string;
  views: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
  }>;
  onSwitch: (id: string) => void;
}

interface AppSidebarUserMenuProps {
  displayName: string;
  displayEmail: string;
  avatarLetter: string;
  unreadCount: number;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  theme: string | undefined;
  setTheme: (theme: string) => void;
  onProfile: () => void;
  onNotifications: () => void;
  onDocs: () => void;
  onLogout: () => void;
  viewSwitcher?: AppSidebarUserMenuViewSwitcher;
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

export function AppSidebarUserMenu({
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
}: AppSidebarUserMenuProps) {
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
              <span className="text-xs text-muted-foreground">
                == {LANGUAGE_LABELS[language]}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <DropdownMenuItem key={lang} onClick={() => setLanguage(lang)}>
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

export function AppSidebarGuestUserButton({
  loginLabel,
  loginHint,
  onLogin,
}: {
  loginLabel: string;
  loginHint: string;
  onLogin: () => void;
}) {
  return (
    <SidebarMenuButton
      size="lg"
      onClick={onLogin}
      className="rounded-lg border border-white/10 bg-white/[0.055] text-white transition-colors hover:bg-white/[0.09] group-data-[collapsible=icon]:justify-center"
    >
      <Avatar className="h-8 w-8 shrink-0 rounded-lg">
        <AvatarFallback className="rounded-lg bg-white/12 text-white">
          ?
        </AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate font-semibold">{loginLabel}</span>
        <span className="truncate text-xs text-muted-foreground">
          {loginHint}
        </span>
      </div>
    </SidebarMenuButton>
  );
}
