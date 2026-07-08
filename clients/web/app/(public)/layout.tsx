'use client';

import { usePathname } from 'next/navigation';
import { PublicGeneratorAppNav } from '@autix/shared-ui/growth';

/**
 * 公开页共享布局：把导航栏提升为跨路由持久的同一实例。
 *
 * 首页/pricing/ai 等在此 layout 下用软导航（Link）切换时，导航不卸载，
 * 只由其内部的 usePathname 更新 variant/kind → CSS 过渡实现「收缩高度 + 展开全宽」。
 *
 * 布局分两种，但**保持相同 DOM 结构**（div > nav + div > children），
 * 只切换 className，从而导航始终是同一节点、过渡不被打断：
 * - 功能页(image/video)：锁定视口高度，内容不满不滚，满了才在内容区内部滚动；
 * - 其它公开页：正常文档(body)滚动（内层 display:contents 让 children 直接参与外层）。
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFunctionPage =
    pathname.startsWith('/ai/image') || pathname.startsWith('/ai/video');

  return (
    <div
      className={
        isFunctionPage
          ? 'flex h-svh flex-col overflow-hidden bg-background text-foreground'
          : 'min-h-svh bg-background text-foreground'
      }
    >
      <PublicGeneratorAppNav />
      <div className={isFunctionPage ? 'min-h-0 flex-1 overflow-y-auto overscroll-none' : 'contents'}>
        {children}
      </div>
    </div>
  );
}
