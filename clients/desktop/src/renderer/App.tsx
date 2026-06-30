'use client';

import { useEffect } from 'react';
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Providers } from './Providers';
import { bindRouter } from './platform';
import { MainLayout } from './layouts/MainLayout';
import { LoginLayout } from './layouts/LoginLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';

// Auth
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { PendingPage } from './pages/pending';
import { ActivatePage } from './pages/activate';
import { ForgotPasswordPage } from './pages/forgot-password';
import { ResetPasswordPage } from './pages/reset-password';

// Chat 业务
import { ChatPage } from './pages/chat';
import { ArenaPage } from './pages/arena';
import { LibraryPage } from './pages/library';
import { NotificationsPage } from './pages/notifications';

// Templates (legacy 路径,通过 redirect 兼容)
import { TemplateDetailPage } from './pages/templates';
import { TemplatesWorkspacePage } from './pages/templates/workspace';

// Marketplace (多资源)
import { MarketplaceHomePage } from './pages/marketplace';
import { MarketplaceListPage } from './pages/marketplace/list';
import { MarketplaceDetailPage } from './pages/marketplace/detail';
import { ProfilePage } from './pages/profile';

// Membership
import { MembershipInvitePage } from './pages/membership/invite';
import { MembershipOrdersPage } from './pages/membership/orders';
import { MembershipPackagesPage } from './pages/membership/packages';
import { MembershipPointsPage } from './pages/membership/points';
import { MembershipUpgradePage } from './pages/membership/upgrade';

// Chat 后台 /system
import { SystemMembershipLevelsPage } from './pages/system/membership-levels';
import { SystemMembershipOrdersPage } from './pages/system/membership-orders';
import { SystemMembershipPackagesPage } from './pages/system/membership-packages';
import { SystemMembershipPointsPage } from './pages/system/membership-points';
import { SystemUsersPage } from './pages/system/users';
import { SystemUserDetailPage } from './pages/system/user-detail';
import { SystemTemplatesPage } from './pages/system/templates';

// 用户中心 /admin
import { AdminDashboardPage } from './pages/admin/dashboard';
import { AdminProfilePage } from './pages/admin/profile';
import { AdminUsersPage } from './pages/admin/users';
import { AdminRolesPage } from './pages/admin/roles';
import { AdminPermissionsPage } from './pages/admin/permissions';

// Workbench
import { VideoWorkbenchPage } from './pages/workbench/video';
import { ImageWorkbenchPage } from './pages/workbench/image';

function NavigationBinder() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    bindRouter(
      { push: navigate, replace: (p: string) => navigate(p, { replace: true }) },
      location.pathname,
    );
  }, [navigate, location.pathname]);

  useEffect(() => {
    const off = window.electron.app.on('deep-link:navigate', (payload) => {
      if (typeof payload === 'string' && payload.startsWith('/')) {
        navigate(payload);
      }
    });
    return off;
  }, [navigate]);

  return null;
}

function AppRoutes() {
  return (
    <>
      <NavigationBinder />
      <Routes>
        <Route element={<LoginLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pending" element={<PendingPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/chat" replace />} />

          {/* Chat business */}
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/c/:id" element={<ChatPage />} />
          <Route path="/arena" element={<ArenaPage />} />
          <Route path="/arena/:id" element={<ArenaPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Workbench */}
          <Route path="/workbench/video" element={<VideoWorkbenchPage />} />
          <Route path="/workbench/image" element={<ImageWorkbenchPage />} />

          {/* Templates (legacy paths,kept until renderer 全量切到 marketplace) */}
          <Route path="/templates" element={<Navigate to="/marketplace/image-templates" replace />} />
          <Route path="/templates/mine" element={<Navigate to="/profile?tab=published" replace />} />
          <Route path="/templates/submit" element={<Navigate to="/marketplace/image-templates" replace />} />
          <Route path="/templates/workspace/:id" element={<TemplatesWorkspacePage />} />
          <Route path="/templates/:id" element={<TemplateDetailPage />} />

          {/* Marketplace 多资源 */}
          <Route path="/marketplace" element={<MarketplaceHomePage />} />
          <Route path="/marketplace/:type" element={<MarketplaceListPage />} />
          <Route path="/marketplace/:type/:id" element={<MarketplaceDetailPage />} />
          <Route path="/marketplace/image-templates/:id/workspace" element={<TemplatesWorkspacePage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Membership */}
          <Route path="/membership" element={<Navigate to="/profile?tab=membership" replace />} />
          <Route path="/membership/invite" element={<MembershipInvitePage />} />
          <Route path="/membership/orders" element={<MembershipOrdersPage />} />
          <Route path="/membership/packages" element={<MembershipPackagesPage />} />
          <Route path="/membership/points" element={<MembershipPointsPage />} />
          <Route path="/membership/upgrade" element={<MembershipUpgradePage />} />

          {/* Chat 系统管理 /system */}
          <Route path="/system" element={<Navigate to="/system/membership/users" replace />} />
          <Route path="/system/templates" element={<SystemTemplatesPage />} />
          <Route path="/system/membership" element={<Navigate to="/system/membership/users" replace />} />
          <Route path="/system/membership/users" element={<SystemUsersPage />} />
          <Route path="/system/membership/users/:id" element={<SystemUserDetailPage />} />
          <Route path="/system/membership/levels" element={<SystemMembershipLevelsPage />} />
          <Route path="/system/membership/orders" element={<SystemMembershipOrdersPage />} />
          <Route path="/system/membership/packages" element={<SystemMembershipPackagesPage />} />
          <Route path="/system/membership/points" element={<SystemMembershipPointsPage />} />

          {/* 用户中心 /admin */}
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/profile" element={<AdminProfilePage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/roles" element={<AdminRolesPage />} />
          <Route path="/admin/permissions" element={<AdminPermissionsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <Providers>
      <ErrorBoundary>
        <OfflineBanner />
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ErrorBoundary>
    </Providers>
  );
}
