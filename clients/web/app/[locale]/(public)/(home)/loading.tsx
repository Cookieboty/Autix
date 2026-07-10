import { HomeGallerySkeleton } from '@autix/shared-ui/public-home';

// 首页路由级 Suspense fallback：仅在软导航 / 首屏流式 shell 阶段短暂展示。
// 不参与 SSR 正文与 generateMetadata，SEO 内容仍由 (home)/page.tsx 服务端渲染，故不影响收录。
// 顶部导航由 (public) layout 持久渲染，故此处不再画导航骨架，只画正文（Featured + 画廊）。
export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true" aria-hidden>
      <div className="mx-auto max-w-[1920px] px-4 py-8 md:px-6">
        {/* Featured 横排 */}
        <div className="mb-4 h-8 w-56 animate-pulse rounded-md bg-secondary" />
        <div className="mb-12 flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-52 w-72 shrink-0 animate-pulse rounded-lg bg-secondary"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>

        {/* 画廊标题 */}
        <div className="mb-6">
          <div className="h-9 w-64 animate-pulse rounded-md bg-secondary" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-secondary" />
        </div>

        {/* 画廊骨架直接复用 HomeGallerySection 落地时的同一组件，避免列布局/高度序列漂移 */}
        <HomeGallerySkeleton />
      </div>
    </div>
  );
}
