'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { hydrateStores } from '@autix/shared-store';
import { bindRouter } from '@/lib/platform';

/**
 * 把 Next.js router 绑到 NavigationAdapter，并在挂载时 hydrate 所有共享 store。
 *
 * **不阻塞渲染**：public 页面（首页等）走渐进增强，登录态在 hydrate 完成后补齐；
 * 受保护路由由各自 layout 的 `hydrated` gate 处理（见 (app)/(admin) layout）。
 * 这样避免整站硬刷新时用全屏 "Loading…" 覆盖掉已 SSR 出来的内容。
 */
export function PlatformBinder({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    bindRouter(router, pathname, searchParams.toString());
  }, [pathname, router, searchParams]);

  useEffect(() => {
    hydrateStores().catch((error) => {
      console.error('hydrate stores failed:', error);
    });
  }, []);

  return <>{children}</>;
}
