import type { SupportedLanguage } from '@autix/i18n';
import { routing } from '@/i18n/routing';

export type Policy =
  | { kind: 'full' }
  | { kind: 'partial'; locales: SupportedLanguage[] }
  | { kind: 'neutral' }
  | { kind: 'noindex' };

const FULL: Policy = { kind: 'full' };
const NEUTRAL: Policy = { kind: 'neutral' };
const NOINDEX: Policy = { kind: 'noindex' };

/**
 * `/docs` 支持的 locale 的唯一真源（`as const` 保留字面量元组类型）。
 * `lib/docs.ts` 的 `UI_STRINGS` 以 `(typeof DOC_LOCALES)[number]` 为键类型，
 * 从而在此列表新增 locale 时，若未补齐对应 UI 文案会直接触发编译错误——
 * 恢复了「声明的 doc locale」与「已有 UI 文案的 locale」之间的编译期耦合。
 */
export const DOC_LOCALES = ['en', 'zh-CN'] as const;
const DOCS: Policy = { kind: 'partial', locales: [...DOC_LOCALES] };

// 注意：此表针对 `clients/web/app/[locale]` 下的真实路由树逐条核对
// （`find clients/web/app/\[locale\] -name page.tsx`）。原始任务简报中的
// `/admin/[...rest]`、`/workbench/[...rest]`、`/membership/[...rest]` 是迁移前的
// catch-all 占位符，实际目录下并不存在这些动态路由——每个页面都是独立的具体路径，
// getPolicy() 按精确字符串匹配，因此必须逐条声明。详见 task-8-report.md。
export const ROUTE_POLICY: Record<string, Policy> = {
  // 全译营销页
  '/': FULL,
  '/pricing': FULL,
  '/ai/video': FULL,
  '/ai/image': FULL,
  '/video': FULL,

  // 部分语言
  '/docs': DOCS,
  '/docs/[...slug]': DOCS,

  // UGC：壳已译，正文未译
  '/marketplace/[type]': NEUTRAL,
  '/marketplace/[type]/[id]': NEUTRAL,

  // 私密分享链接（修复既有索引泄漏，见 spec §5.1.1）
  '/share/video/[token]': NOINDEX,
  '/s/v/[code]': NOINDEX,

  // 认证 / 账户流程 / 后台
  '/login': NOINDEX,
  '/register': NOINDEX,
  '/forgot-password': NOINDEX,
  '/reset-password': NOINDEX,
  '/activate': NOINDEX,
  '/pending': NOINDEX,
  '/email/confirm': NOINDEX,
  '/oauth/callback': NOINDEX,
  '/oauth/popup-callback': NOINDEX,
  '/chat': NOINDEX,
  '/c/[id]': NOINDEX,
  '/draw': NOINDEX,
  '/arena': NOINDEX,
  '/arena/[id]': NOINDEX,
  '/library': NOINDEX,
  '/materials': NOINDEX,
  '/profile': NOINDEX,
  '/notifications': NOINDEX,

  // 后台管理（每个都是具体路径，无 catch-all）
  '/admin': NOINDEX,
  '/admin/audit-logs': NOINDEX,
  '/admin/boosts': NOINDEX,
  '/admin/campaigns': NOINDEX,
  '/admin/featured-slots': NOINDEX,
  '/admin/gallery': NOINDEX,
  '/admin/membership/levels': NOINDEX,
  '/admin/membership/orders': NOINDEX,
  '/admin/membership/packages': NOINDEX,
  '/admin/membership/points': NOINDEX,
  '/admin/membership/task-costs': NOINDEX,
  '/admin/membership/users': NOINDEX,
  '/admin/membership/users/[id]': NOINDEX,
  '/admin/models': NOINDEX,
  '/admin/permission-center': NOINDEX,
  '/admin/profile': NOINDEX,
  '/admin/prompts': NOINDEX,
  '/admin/risk': NOINDEX,
  '/admin/roles': NOINDEX,
  '/admin/settings': NOINDEX,
  '/admin/templates': NOINDEX,
  '/admin/users': NOINDEX,

  // 会员 / 工作台（同样无 catch-all，逐条声明）
  '/membership': NOINDEX,
  '/membership/benefits': NOINDEX,
  '/membership/invite': NOINDEX,
  '/membership/orders': NOINDEX,
  '/membership/orders/[id]': NOINDEX,
  '/membership/orders/checkout': NOINDEX,
  '/membership/packages': NOINDEX,
  '/membership/points': NOINDEX,
  '/membership/rewards': NOINDEX,
  '/membership/upgrade': NOINDEX,
};

export function getPolicy(template: string): Policy {
  const policy = ROUTE_POLICY[template];
  if (!policy) {
    throw new Error(
      `ROUTE_POLICY is missing a route declaration for "${template}". ` +
        `New pages must declare their localization policy in clients/web/lib/i18n/route-policy.ts.`,
    );
  }
  return policy;
}

function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1) || '/';
  }
  return pathname || '/';
}

function normalizePolicyPath(pathname: string): string {
  const withoutLocale = stripLocalePrefix(pathname.split('?')[0] || '/');
  if (withoutLocale === '/') return '/';
  return withoutLocale.replace(/\/+$/, '');
}

function templateToRegex(template: string): RegExp {
  const source = template
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\[\\\.\\\.\\\.[^\]]+\\\]/g, '.+')
    .replace(/\\\[[^\]]+\\\]/g, '[^/]+');
  return new RegExp(`^${source}$`);
}

export function getPolicyForPathname(pathname: string): Policy | undefined {
  const normalized = normalizePolicyPath(pathname);
  const exact = ROUTE_POLICY[normalized];
  if (exact) return exact;

  for (const [template, policy] of Object.entries(ROUTE_POLICY)) {
    if (template.includes('[') && templateToRegex(template).test(normalized)) {
      return policy;
    }
  }

  return undefined;
}

export function isNoindexPathname(pathname: string): boolean {
  return getPolicyForPathname(pathname)?.kind === 'noindex';
}

/**
 * `as-needed`：默认 locale 不带前缀。
 * 定义在此处（而非 build-alternates.ts），因为 sitemap.ts 也要用，
 * 且它描述的是路由形状，不是 metadata 关注点。
 */
export function localizedPath(path: string, locale: SupportedLanguage): string {
  if (locale === routing.defaultLocale) return path;
  // 根路径特判：朴素拼接会得到 `/zh-CN/`（尾斜杠）。没有 `trailingSlash` 配置时
  // Next 会把 `/zh-CN/` 308 重定向到 `/zh-CN`，导致 sitemap 提交重定向 URL、
  // 首页 hreflang 簇指向会被 Google 丢弃的重定向 URL、canonical 自指向一个又跳回
  // 自己的 URL。因此根路径直接返回 `/${locale}`，不带尾斜杠。
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/** 可进 sitemap 的静态路由（路径在构建期完整可枚举）。 */
export const SITEMAP_STATIC_ROUTES = [
  '/', '/pricing', '/ai/video', '/ai/image',
  '/video',
  '/docs',
] as const;
