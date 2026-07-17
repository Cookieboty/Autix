'use client';

import { useEffect } from 'react';
import { useAuthStore, useUiStore } from '@autix/shared-store';

/**
 * 素材库需登录：直达且未登录时唤起登录弹窗（顶部导航仍由 (public) layout 提供）。
 * 与 me/settings 同一套路——(public) layout 本身不做鉴权。
 */
export default function AssetLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openAuthModal = useUiStore((s) => s.openAuthModal);

  useEffect(() => {
    if (hydrated && !isAuthenticated) openAuthModal({ mode: 'entry', returnTo: '/asset/all' });
  }, [hydrated, isAuthenticated, openAuthModal]);

  return <>{children}</>;
}
