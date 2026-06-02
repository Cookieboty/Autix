'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { hydrateStores } from '@autix/shared-store';
import { bindRouter } from '@/lib/platform';

/**
 * 把 Next.js router 绑到 NavigationAdapter，并在挂载时 hydrate 所有共享 store。
 * **阻塞渲染** 直到 hydrate 完成 — 否则下游 layout 拿到 isAuthenticated=false 会误跳登录页。
 */
export function PlatformBinder({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  bindRouter(router, pathname);

  useEffect(() => {
    hydrateStores()
      .catch((error) => {
        console.error('hydrate stores failed:', error);
      })
      .finally(() => setHydrated(true));
  }, []);

  if (!hydrated) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontSize: 14,
          color: 'var(--muted)',
        }}
      >
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
