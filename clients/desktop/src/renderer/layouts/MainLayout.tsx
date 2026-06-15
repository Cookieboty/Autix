'use client';

import { useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@autix/shared-store';
import {
  Crown,
  Users,
  Shield,
  Network,
  Receipt,
  History,
  Zap,
  ShieldCheck,
  Layers,
  LayoutDashboard,
  MessageSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SidebarInset, SidebarProvider } from '@autix/shared-ui/ui';
import { AppSidebar } from '@autix/shared-ui/chat';
import { NotificationDrawer } from '@autix/shared-ui/notifications';
import { TaskSseProvider } from '@autix/shared-ui/providers';
import type { AppSidebarNavItem, AppSidebarViewOption } from '@autix/shared-ui/chat';

const isMac =
  typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');

type ViewMode = 'user' | 'system' | 'admin';

const VIEW_META: Record<
  ViewMode,
  { label: string; icon: LucideIcon; defaultPath: string }
> = {
  user: { label: '聊天工作台', icon: MessageSquare, defaultPath: '/chat' },
  // defaultPath 必须与 App.tsx 注册的路由完全一致，否则被通配规则打回 /chat
  system: { label: 'Chat 系统管理', icon: ShieldCheck, defaultPath: '/system/membership/users' },
  admin: { label: '用户中心管理', icon: Layers, defaultPath: '/admin/users' },
};

function detectView(pathname: string): ViewMode {
  if (pathname.startsWith('/system')) return 'system';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'user';
}

function useSystemNavItems(pathname: string): AppSidebarNavItem[] {
  // 路径与 chat-web 的 /system/* 完全对齐
  return [
    { label: '用户管理', icon: Users, href: '/system/membership/users', active: pathname.startsWith('/system/membership/users') },
    { label: '会员等级', icon: Crown, href: '/system/membership/levels', active: pathname.startsWith('/system/membership/levels') },
    { label: '订单管理', icon: Receipt, href: '/system/membership/orders', active: pathname.startsWith('/system/membership/orders') },
    { label: '积分流水', icon: History, href: '/system/membership/points', active: pathname.startsWith('/system/membership/points') },
    { label: '积分加油包', icon: Zap, href: '/system/membership/packages', active: pathname.startsWith('/system/membership/packages') },
    { label: '模板审核', icon: ShieldCheck, href: '/system/templates', active: pathname.startsWith('/system/templates') },
  ];
}

function useAdminNavItems(pathname: string): AppSidebarNavItem[] {
  return [
    { label: '仪表盘', icon: LayoutDashboard, href: '/admin', active: pathname === '/admin' },
    { label: '用户', icon: Users, href: '/admin/users', active: pathname.startsWith('/admin/users') },
    { label: '角色', icon: Shield, href: '/admin/roles', active: pathname.startsWith('/admin/roles') },
    { label: '权限', icon: Network, href: '/admin/permissions', active: pathname.startsWith('/admin/permissions') },
  ];
}

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, user } = useAuthStore();

  const currentView = detectView(location.pathname);
  const systemNav = useSystemNavItems(location.pathname);
  const adminNav = useAdminNavItems(location.pathname);

  // user 视角下让 AppSidebar 用内置默认 nav（New session / Arena / Marketplace + Bell），
  // 与 chat-web 行为完全一致；system/admin 视角才传 customNavItems。
  const customNavItems =
    currentView === 'system'
      ? systemNav
      : currentView === 'admin'
        ? adminNav
        : undefined;

  // 按用户在每个 system 的实际权限计算可切换的视角：
  //   - user 视角：所有登录用户都有（chat 业务）
  //   - system 视角（chat 后台）：isSuperAdmin 或 在 chat 系统是 SYSTEM_ADMIN
  //   - admin 视角（用户中心）：isSuperAdmin 或 user.systems 包含 admin-system
  const availableViews = useMemo<ViewMode[]>(() => {
    const u = user as
      | {
          isSuperAdmin?: boolean;
          systems?: Array<{ id: string; code: string }>;
          currentSystemId?: string;
          roles?: string[];
        }
      | null;
    const views: ViewMode[] = u ? ['user'] : [];
    const isSuper = u?.isSuperAdmin === true;
    const systems = u?.systems ?? [];
    const inChatSystem = systems.some((s) => s.code === 'chat');
    const inAdminSystem = systems.some((s) => s.code === 'admin-system');
    if (isSuper || (isAdmin && inChatSystem)) views.push('system');
    if (isSuper || inAdminSystem) views.push('admin');
    return views;
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  // 用户访问无权限的视角时重定向回 chat
  useEffect(() => {
    if (currentView !== 'user' && !availableViews.includes(currentView)) {
      navigate('/chat', { replace: true });
    }
  }, [currentView, availableViews, navigate]);

  if (!isAuthenticated) return null;

  const viewSwitcher: { currentId: string; views: AppSidebarViewOption[]; onSwitch: (id: string) => void } | undefined =
    availableViews.length > 0
      ? {
          currentId: currentView,
          views: availableViews.map((view) => ({
            id: view,
            label: VIEW_META[view].label,
            icon: VIEW_META[view].icon,
          })),
          onSwitch: (id) => navigate(VIEW_META[id as ViewMode].defaultPath),
        }
      : undefined;

  return (
    <TaskSseProvider>
      {/*
        macOS 红绿灯专属 drag region：仅左上角 80×24 浮动透明区。
        24px 给红绿灯留 ~10px 缓冲，避免 logo 视觉重叠。
      */}
      {isMac && (
        <div
          className="app-drag pointer-events-none fixed left-0 top-0 z-100 h-6 w-20"
          aria-hidden
        />
      )}
      {/*
        macOS 让位 pt-6 (24px)：sidebar header 与 inset topbar 同时下移，
        中心线均落在 y=56px，水平对齐 + 红绿灯不重叠。
      */}
      <SidebarProvider
        className={`h-svh w-svw overflow-hidden${isMac ? ' pt-6' : ''}`}
        style={{ '--sidebar-width-icon': '2.75rem' } as React.CSSProperties}
      >
        <AppSidebar
          customNavItems={customNavItems}
          showRecentChats={currentView === 'user'}
          viewSwitcher={viewSwitcher}
        />
        <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <NotificationDrawer />
    </TaskSseProvider>
  );
}
