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

// Auth
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { PendingPage } from './pages/pending';

// Chat 业务
import { ChatPage } from './pages/chat';
import { ArenaPage } from './pages/arena';
import { LibraryPage } from './pages/library';
import { ModelsPage } from './pages/models';
import { NotificationsPage } from './pages/notifications';

// Templates
import { TemplatesPage, TemplateDetailPage } from './pages/templates';
import { TemplatesMinePage } from './pages/templates/mine';
import { TemplatesSubmitPage } from './pages/templates/submit';
import { TemplatesWorkspacePage } from './pages/templates/workspace';

// Membership
import { MembershipPage } from './pages/membership';
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
import { SystemTaskCostsPage } from './pages/system/task-costs';
import { SystemUsersPage } from './pages/system/users';
import { SystemUserDetailPage } from './pages/system/user-detail';
import { SystemTemplatesPage } from './pages/system/templates';

// 用户中心 /admin
import { AdminDashboardPage } from './pages/admin/dashboard';
import { AdminProfilePage } from './pages/admin/profile';
import { AdminUsersPage } from './pages/admin/users';
import { AdminRolesPage } from './pages/admin/roles';
import { AdminPermissionsPage } from './pages/admin/permissions';

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
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Templates */}
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/mine" element={<TemplatesMinePage />} />
          <Route path="/templates/submit" element={<TemplatesSubmitPage />} />
          <Route path="/templates/workspace/:id" element={<TemplatesWorkspacePage />} />
          <Route path="/templates/:id" element={<TemplateDetailPage />} />

          {/* Membership */}
          <Route path="/membership" element={<MembershipPage />} />
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
          <Route path="/system/membership/task-costs" element={<SystemTaskCostsPage />} />

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
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </Providers>
  );
}
