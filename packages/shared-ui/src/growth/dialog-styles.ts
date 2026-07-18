/**
 * 计费相关弹框的统一外壳样式，对标导航头像下拉（PublicAccountMenu 的 DropdownMenuContent）：
 * rounded-2xl + border-border + bg-card + growth-dropdown-shadow，并抵消 dialog 基础件的 ring。
 * 内容区域样式对标 /pricing 页（PlanCards / TopUpPacks）。
 */

/** DialogContent 外壳：与导航下拉同一套圆角/描边/底色/投影 */
export const GROWTH_DIALOG_CONTENT =
  'flex flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground growth-dropdown-shadow ring-0';

/** DialogHeader：贴合外壳的内边距与分隔线 */
export const GROWTH_DIALOG_HEADER = 'shrink-0 border-b border-border px-5 py-4';

/** DialogTitle：沿用 pricing 页标题字重 */
export const GROWTH_DIALOG_TITLE =
  'flex items-center gap-2 text-base font-black uppercase tracking-tight text-foreground';

/** DialogDescription */
export const GROWTH_DIALOG_DESCRIPTION = 'text-xs text-foreground/50';

/** DialogFooter */
export const GROWTH_DIALOG_FOOTER = 'shrink-0 border-t border-border px-5 py-4';

/**
 * CTA 焦点环。改用原生 <button>（为了拿 inline 的档位主色）后不再继承 ui/Button
 * 的 focus-visible 样式，这里补回来，键盘导航仍要看得见落点。
 */
export const GROWTH_CTA_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** pricing 卡片外框：中性档（PlanCards 的 neutral tone） */
export const GROWTH_CARD =
  'rounded-2xl border border-white/10 bg-white/[0.025] transition duration-300 hover:border-white/20 hover:bg-white/[0.05]';

/** pricing 卡片内的数值盒子（积分/额度） */
export const GROWTH_CARD_INSET = 'rounded-xl border border-white/10 bg-black/20 p-4';
