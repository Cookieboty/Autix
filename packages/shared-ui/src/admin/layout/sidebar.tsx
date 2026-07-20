'use client';

import * as React from 'react';
import { useTheme } from '../../theme';
import { useTranslations } from 'next-intl';
import {
  ChevronsUpDown,
  Crown,
  FileText,
  Flame,
  Folder,
  Gift,
  Globe,
  History,
  Key,
  Languages,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Network,
  Receipt,
  Settings,
  Shield,
  ShieldAlert,
  Sun,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { ThemeLogo } from '../../brand';
import { useRouter, usePathname } from '../../navigation';
import {
  useAdminLogoutController,
  useAuthStore,
  useLanguageStore,
} from '@autix/shared-store';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  type SupportedLanguage,
} from '@autix/i18n';

import { Avatar, AvatarFallback } from '../../ui/avatar';
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
} from '../../ui/dropdown-menu';
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../../ui/sidebar';

const iconMap: Record<string, LucideIcon> = {
  Crown,
  FileText,
  Flame,
  Folder,
  Gift,
  Globe,
  History,
  Key,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Menu: MenuIcon,
  Network,
  Receipt,
  Settings,
  Shield,
  ShieldAlert,
  User,
  Users,
  Zap,
};

function isModelConfigMenuPath(path?: string | null) {
  const normalized = (path ?? '').replace(/\/+$/, '') || '/';
  return normalized === '/models' || normalized === '/admin/models';
}

function isCampaignsMenuPath(path?: string | null) {
  const normalized = (path ?? '').replace(/\/+$/, '') || '/';
  return normalized === '/campaigns' || normalized === '/admin/campaigns';
}

export interface AdminSidebarProps
  extends Omit<React.ComponentProps<typeof SidebarPrimitive>, 'children'> {
  brandLabel?: string;
  basePath?: string;
}

export function Sidebar({
  brandLabel = 'Amux Admin',
  basePath = '',
  ...sidebarProps
}: AdminSidebarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { menus, user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const { logoutRemote } = useAdminLogoutController();
  const t = useTranslations('layout');
  const tAuth = useTranslations('auth');

  const bp = basePath.replace(/\/+$/, '');

  const visibleMenus = React.useMemo(
    () => {
      const topMenus = menus.filter(
        (menu) => menu.visible && !menu.parentId,
      );
      const hasSystemSettings = topMenus.some((menu) => menu.path === '/settings');
      const hasSystemPrompts = topMenus.some((menu) => menu.path === '/prompts');
      const hasSystemModels = topMenus.some((menu) => isModelConfigMenuPath(menu.path));
      const hasRisk = topMenus.some((menu) => menu.path === '/risk');
      const hasCampaigns = topMenus.some((menu) => isCampaignsMenuPath(menu.path));
      return [
        ...topMenus,
        ...(!hasRisk
          ? [{
              id: 'fallback-risk',
              name: t('navRiskManagement'),
              path: '/risk',
              icon: 'ShieldAlert',
              sort: 11,
              visible: true,
            }]
          : []),
        ...(!hasSystemModels
          ? [{
              id: 'fallback-system-models',
              name: t('navSystemModels'),
              path: '/models',
              icon: 'Globe',
              sort: 9,
              visible: true,
            }]
          : []),
        ...(!hasSystemSettings
          ? [{
              id: 'fallback-system-settings',
              name: t('navSystemSettings'),
              path: '/settings',
              icon: 'Settings',
              sort: 10,
              visible: true,
            }]
          : []),
        ...(!hasSystemPrompts
          ? [{
              id: 'fallback-system-prompts',
              name: t('navSystemPrompts'),
              path: '/prompts',
              icon: 'FileText',
              sort: 11,
              visible: true,
            }]
          : []),
        ...(!hasCampaigns
          ? [{
              id: 'fallback-campaigns',
              name: t('navCampaignRewards'),
              path: '/campaigns',
              icon: 'Gift',
              sort: 8,
              visible: true,
            }]
          : []),
      ].sort((a, b) => a.sort - b.sort);
    },
    [menus, t],
  );

  const handleLogout = async () => {
    try {
      await logoutRemote();
    } catch {
      // ignore
    } finally {
      logout();
      router.push('/');
    }
  };

  const userAny = user as
    | { realName?: string; username?: string; email?: string }
    | null;
  const displayName =
    userAny?.realName || userAny?.username || t('defaultUser');
  const displayEmail = userAny?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const homePath = bp || '/';
  const overviewActive = pathname === homePath;

  return (
    <SidebarPrimitive variant="inset" collapsible="icon" {...sidebarProps}>
      <SidebarHeader className="group-data-[collapsible=icon]:p-1.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="group-data-[collapsible=icon]:justify-center"
            >
              <a
                href={homePath}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(homePath);
                }}
              >
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <ThemeLogo
                    alt={brandLabel}
                    size={32}
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t('overview')}
                  isActive={overviewActive}
                  onClick={() => router.push(homePath)}
                  className="group-data-[collapsible=icon]:justify-center"
                >
                  <LayoutDashboard />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {t('overview')}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {visibleMenus.map((menu) => {
                const Icon = iconMap[menu.icon || 'Menu'] || MenuIcon;
                const fullPath =
                  bp && (menu.path === bp || menu.path.startsWith(`${bp}/`))
                    ? menu.path
                    : bp + menu.path;
                const isActive =
                  pathname === fullPath ||
                  (fullPath !== homePath && pathname.startsWith(fullPath));
                return (
                  <SidebarMenuItem key={menu.id}>
                    <SidebarMenuButton
                      tooltip={menu.name}
                      isActive={isActive}
                      onClick={() => router.push(fullPath)}
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      <Icon />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {menu.name}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:p-1.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <NavUser
              displayName={displayName}
              displayEmail={displayEmail}
              avatarLetter={avatarLetter}
              language={language}
              setLanguage={setLanguage}
              theme={theme}
              setTheme={setTheme}
              onProfile={() => router.push(`${bp}/profile`)}
              onLogout={handleLogout}
              labels={{
                profile: t('profile'),
                userMenu: t('userActions'),
                switchThemeLight: t('switchLightMode'),
                switchThemeDark: t('switchDarkMode'),
                logout: tAuth('logout'),
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarPrimitive>
  );
}

interface NavUserProps {
  displayName: string;
  displayEmail: string;
  avatarLetter: string;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  theme: string | undefined;
  setTheme: (t: string) => void;
  onProfile: () => void;
  onLogout: () => void;
  labels: {
    profile: string;
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
  language,
  setLanguage,
  theme,
  setTheme,
  onProfile,
  onLogout,
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
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Languages />
              <span className="flex-1">{LANGUAGE_LABELS[language]}</span>
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
