'use client';

import { useEffect } from 'react';
import { useAuthStore, useUiStore } from '@autix/shared-store';
import { AccountSettingsShell } from '@autix/shared-ui/growth';

export default function AccountSettingsLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openAuthModal = useUiStore((s) => s.openAuthModal);

  // 账户设置需登录：直达且未登录时唤起登录弹窗（顶部导航仍由 (public) layout 提供）。
  useEffect(() => {
    if (hydrated && !isAuthenticated) openAuthModal({ mode: 'entry', returnTo: '/me/settings' });
  }, [hydrated, isAuthenticated, openAuthModal]);

  return <AccountSettingsShell>{children}</AccountSettingsShell>;
}
