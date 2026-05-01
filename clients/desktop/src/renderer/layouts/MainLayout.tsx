'use client';

import { useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@autix/shared-store';
import {
  MessageSquare,
  Swords,
  Sparkles,
  FolderOpen,
  FolderHeart,
  Cpu,
  Crown,
  Bell,
  Users,
  Shield,
  Network,
  Settings,
  Receipt,
  History,
  Zap,
  ShieldCheck,
  Layers,
  LayoutDashboard,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  ChatSidebar,
  type SidebarNavItem,
  type SidebarViewOption,
  useRouter,
} from '@autix/shared-ui';
import { useChatStore } from '@autix/shared-store';
import { useTranslations } from 'next-intl';
import { TitleBar } from '../components/TitleBar';

type ViewMode = 'user' | 'system' | 'admin';

const VIEW_META: Record<
  ViewMode,
  { label: string; icon: LucideIcon; defaultPath: string }
> = {
  user: { label: '聊天工作台', icon: MessageSquare, defaultPath: '/chat' },
  // defaultPath 必须与 App.tsx 注册的路由完全一致，否则被通配规则打回 /chat
  system: { label: 'Chat 系统管理', icon: Settings, defaultPath: '/system/membership/users' },
  admin: { label: '用户中心管理', icon: Layers, defaultPath: '/admin/users' },
};

function detectView(pathname: string): ViewMode {
  if (pathname.startsWith('/system')) return 'system';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'user';
}

function useSystemNavItems(pathname: string): SidebarNavItem[] {
  // 路径与 chat-web 的 /system/* 完全对齐
  return [
    { label: '用户管理', icon: Users, href: '/system/membership/users', active: pathname.startsWith('/system/membership/users') },
    { label: '会员等级', icon: Crown, href: '/system/membership/levels', active: pathname.startsWith('/system/membership/levels') },
    { label: '订单管理', icon: Receipt, href: '/system/membership/orders', active: pathname.startsWith('/system/membership/orders') },
    { label: '积分流水', icon: History, href: '/system/membership/points', active: pathname.startsWith('/system/membership/points') },
    { label: '积分加油包', icon: Zap, href: '/system/membership/packages', active: pathname.startsWith('/system/membership/packages') },
    { label: '任务消耗', icon: Settings, href: '/system/membership/task-costs', active: pathname.startsWith('/system/membership/task-costs') },
    { label: '模板审核', icon: ShieldCheck, href: '/system/templates', active: pathname.startsWith('/system/templates') },
  ];
}

function useAdminNavItems(pathname: string): SidebarNavItem[] {
  return [
    { label: '仪表盘', icon: LayoutDashboard, href: '/admin', active: pathname === '/admin' },
    { label: '用户', icon: Users, href: '/admin/users', active: pathname.startsWith('/admin/users') },
    { label: '角色', icon: Shield, href: '/admin/roles', active: pathname.startsWith('/admin/roles') },
    { label: '权限', icon: Network, href: '/admin/permissions', active: pathname.startsWith('/admin/permissions') },
  ];
}

function useChatNavItems(pathname: string): SidebarNavItem[] {
  const { createSession } = useChatStore();
  const router = useRouter();
  const tChat = useTranslations('chat');

  const handleNewChat = async () => {
    const id = await createSession(tChat('newConversation'));
    router.push(`/chat/${id}`);
  };

  // 模板市场和"我的模板"路径相邻，需要分别精确匹配避免互相高亮
  const isTemplateMarket =
    pathname === '/templates' ||
    (pathname.startsWith('/templates/') &&
      !pathname.startsWith('/templates/mine') &&
      !pathname.startsWith('/templates/submit'));
  const isMyTemplates = pathname.startsWith('/templates/mine');

  return [
    { label: '新建会话', icon: Plus, href: '/chat', action: handleNewChat },
    { label: 'Arena', icon: Swords, href: '/arena', active: pathname.startsWith('/arena') },
    { label: '模板市场', icon: Sparkles, href: '/templates', active: isTemplateMarket },
    { label: '我的模板', icon: FolderHeart, href: '/templates/mine', active: isMyTemplates },
    { label: '文档库', icon: FolderOpen, href: '/library', active: pathname === '/library' },
    { label: '模型', icon: Cpu, href: '/models', active: pathname === '/models' },
    { label: '会员', icon: Crown, href: '/membership', active: pathname.startsWith('/membership') },
    { label: '通知', icon: Bell, href: '/notifications', active: pathname === '/notifications' },
  ];
}

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, user } = useAuthStore();

  const currentView = detectView(location.pathname);

  const chatNav = useChatNavItems(location.pathname);
  const systemNav = useSystemNavItems(location.pathname);
  const adminNav = useAdminNavItems(location.pathname);

  const navItems =
    currentView === 'system' ? systemNav : currentView === 'admin' ? adminNav : chatNav;

  // 按用户在每个 system 的实际权限计算可切换的视角：
  //   - user 视角：所有登录用户都有（chat 业务）
  //   - system 视角（chat 后台）：isSuperAdmin 或 在 chat 系统是 SYSTEM_ADMIN
  //   - admin 视角（用户中心）：isSuperAdmin 或 user.systems 包含 admin-system
  // 注意 user.roles 是当前 currentSystemId 下的角色，不包含跨系统信息，所以
  // 判断"在 chat 系统是否 admin"只能近似为"当前在 chat 系统且 isAdmin"。
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

  // 数据驱动的视角切换器（ChatSidebar 内部用，避免 React Aria 不识别外部 Section）
  const viewSwitcher: { currentId: string; views: SidebarViewOption[]; onSwitch: (id: string) => void } | undefined =
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--app-shell)',
        color: 'var(--foreground)',
      }}
    >
      <TitleBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ChatSidebar
          customNavItems={navItems}
          showRecentChats={currentView === 'user'}
          viewSwitcher={viewSwitcher}
        />
        {/* main 用 inline style 而非 Tailwind className，避免 class 扫描偶发失效。
            内层圆角面板用 flex-col 让 page（h-full / flex-1）正确 stretch 全宽和全高。 */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '12px',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 8,
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--border)',
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
