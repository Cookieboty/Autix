/**
 * 广场作品详情的骨架屏。
 *
 * 两处共用：路由级 loading.tsx（服务端，导航到该页时立刻显示）与 GalleryPostView
 * 客户端拉 getDetail 期间 —— 两者形状必须一致，否则会看到骨架换骨架的二次跳变。
 *
 * 形状照着 MediaDetailShell 来：左媒体区 + 右 340px 面板（作者条 / PROMPT 卡 / DETAILS 卡 /
 * 底部按钮），这样数据到位时是「骨架就地变成内容」，不是「整页重排」。
 */
export function GalleryDetailSkeleton() {
  return (
    <div className="fixed inset-0 z-[120] flex bg-[#000c] text-foreground" aria-busy="true">
      <div className="absolute inset-0 -z-10 bg-black" aria-hidden="true" />

      {/* 左：媒体区 */}
      <div className="relative flex min-w-0 flex-1 items-center justify-center p-6">
        <div className="h-[70svh] w-[52%] animate-pulse rounded-md bg-white/[0.06]" />
      </div>

      {/* 右：信息面板 */}
      <aside className="relative m-3 flex w-[340px] shrink-0 flex-col gap-3 rounded-2xl bg-[rgba(35,38,42,0.75)] p-3 backdrop-blur-xl">
        {/* 作者条 */}
        <div className="flex items-center gap-2.5 px-1 pt-1">
          <div className="size-8 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="grid gap-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-white/[0.08]" />
            <div className="h-2.5 w-12 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>

        {/* PROMPT 卡 */}
        <section className="grid gap-2 rounded-xl bg-white/[0.04] p-3">
          <div className="h-3 w-16 animate-pulse rounded bg-white/[0.08]" />
          {[100, 92, 96, 70].map((width) => (
            <div
              key={width}
              className="h-2.5 animate-pulse rounded bg-white/[0.06]"
              style={{ width: `${width}%` }}
            />
          ))}
        </section>

        {/* DETAILS 卡 */}
        <section className="grid gap-2.5 rounded-xl bg-white/[0.04] p-3">
          <div className="h-3 w-16 animate-pulse rounded bg-white/[0.08]" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <div className="h-2.5 w-14 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.06]" />
            </div>
          ))}
        </section>

        <div className="flex-1" />

        {/* 底部按钮 */}
        <div className="grid gap-2">
          <div className="grid grid-cols-[auto_auto_1fr] gap-2">
            <div className="h-10 w-16 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="size-10 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="h-10 animate-pulse rounded-xl bg-white/[0.08]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="h-10 animate-pulse rounded-xl bg-white/[0.06]" />
          </div>
        </div>
      </aside>
    </div>
  );
}
