'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { hydrateStores } from '@autix/shared-store';
import { bindRouter } from '@/lib/platform';

/**
 * useSearchParams 会让所在 Suspense 边界内的内容强制 client-render（CSR bailout）。
 * 因此把读取它的逻辑单独拎出来、就地用 Suspense 包住，且**不作为 children 的祖先**——
 * 否则整棵页面树都被拖进客户端渲染、无法静态预渲染。这就是它自带 Suspense、而不是
 * 依赖根布局页面槽位边界的原因（页面槽位边界只兜 children，兜不到这个 root 级组件）。
 */
function RouterBinder() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    bindRouter(router, pathname, searchParams.toString());
  }, [pathname, router, searchParams]);

  return null;
}

/**
 * 把 Next.js router 绑到 NavigationAdapter，并在挂载时 hydrate 所有共享 store。
 *
 * **不阻塞渲染**：public 页面（首页等）走渐进增强，登录态在 hydrate 完成后补齐；
 * 受保护路由由各自 layout 的 `hydrated` gate 处理（见 (app)/(admin) layout）。
 * 这样避免整站硬刷新时用全屏 "Loading…" 覆盖掉已 SSR 出来的内容。
 */
export function PlatformBinder({ children }: { children: React.ReactNode }) {
  // URL 激活的 locale 是语言收敛的最高优先级来源，必须传给 hydrate——否则
  // localStorage 里的旧值会覆盖 URL/cookie，产生「页面英文、选择器中文」的错位。
  const locale = useLocale();

  useEffect(() => {
    hydrateStores(locale).catch((error) => {
      console.error('hydrate stores failed:', error);
    });
  }, [locale]);

  return (
    <>
      <Suspense fallback={null}>
        <RouterBinder />
      </Suspense>
      {children}
    </>
  );
}
