import * as React from "react"

import { cn } from "./utils"

// 自包含 keyframes：indeterminate 进度块从左滑到右循环，便于在任意宿主（web/desktop）复用，
// 不依赖全局 CSS 里预置的动画。
const ROUTE_PROGRESS_KEYFRAMES = `
@keyframes autix-route-progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
`

/**
 * 全屏/整页路由级加载态：居中的一条细进度条（indeterminate 动画），进度块用品牌主色。
 * 替代此前散落各处的「居中文字 Loading…」。
 *
 * 默认铺满视口高度（min-h-svh）；受限容器内使用时传 className 覆盖高度即可。
 * `label` 用于屏幕阅读器提示，调用方应传本地化文案（如 t('loading')）。
 */
function RouteLoader({
  className,
  barClassName,
  label = "Loading",
  ...props
}: React.ComponentProps<"div"> & { barClassName?: string; label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex min-h-svh w-full items-center justify-center bg-background",
        className
      )}
      {...props}
    >
      <style>{ROUTE_PROGRESS_KEYFRAMES}</style>
      <div
        className={cn(
          "relative h-1 w-40 overflow-hidden rounded-full bg-muted/60",
          barClassName
        )}
      >
        <div
          className="absolute inset-y-0 left-0 w-1/3 rounded-full"
          // 内联兜底色：宿主未定义 --growth-accent（如桌面端）时回退到品牌绿，避免进度块透明不可见
          style={{
            background: "var(--growth-accent, #d1fe17)",
            animation: "autix-route-progress 1.1s ease-in-out infinite",
          }}
        />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export { RouteLoader }
