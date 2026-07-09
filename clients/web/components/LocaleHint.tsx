'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { normalizeLang, LANGUAGE_LABELS, type SupportedLanguage } from '@autix/i18n';
import { usePathname, getPathname } from '@/i18n/navigation';
import { matchRoutePolicy } from '@/lib/i18n/match-route-policy';

const DISMISS_COOKIE = 'locale-hint-dismissed';

/** 正确解析 cookie：按 `;` 拆成键值对，精确比对键名与值，避免子串误判。 */
export function isHintDismissed(cookieString: string): boolean {
  return cookieString.split(';').some((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return false;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    return name === DISMISS_COOKIE && value === '1';
  });
}

/**
 * 给定当前（已剥离 locale 的）pathname 与浏览器偏好 locale，返回该路由「确实服务」的
 * 可建议 locale；不该建议时返回 null。纯函数，便于单测。
 * - full：任意 7 语可建议
 * - partial：仅 policy.locales 内的可建议（否则 `/ja/docs` 会 notFound）
 * - neutral / noindex：壳已译，任意 locale 均可
 * - 无模板命中：返回 null（不瞎猜）
 */
export function suggestionForRoute(
  pathname: string,
  preferred: SupportedLanguage,
): SupportedLanguage | null {
  const policy = matchRoutePolicy(pathname);
  if (!policy) return null;
  if (policy.kind === 'partial' && !policy.locales.includes(preferred)) return null;
  return preferred;
}

/**
 * 纯客户端组件：`localeDetection: false` 下裸路径不会按 Accept-Language 重定向，
 * 这里用 `navigator.language` 在客户端补一层人性化提示，不读 `headers()`（会强制
 * 该路由退出静态渲染 —— 见 Task 12 简报）。
 *
 * 首屏（服务端渲染 + 客户端 hydrate 前）恒定渲染 null；横幅只在挂载后的 effect 里
 * 依据 cookie + navigator.language + 当前路由策略决定是否出现。
 *
 * 布局：横幅用 `position: fixed`（贴底）作为悬浮层，【不进入文档流】，因此从 null
 * 变为可见时不会把页面内容推下去（消除布局位移）。选贴底而非贴顶，避免遮挡页头/导航。
 */
export function LocaleHint() {
  const locale = useLocale() as SupportedLanguage;
  const pathname = usePathname();
  const t = useTranslations('localeHint');
  const [suggest, setSuggest] = React.useState<SupportedLanguage | null>(null);

  React.useEffect(() => {
    if (isHintDismissed(document.cookie)) return;
    const preferred = normalizeLang(navigator.language);
    if (!preferred || preferred === locale) {
      setSuggest(null);
      return;
    }
    setSuggest(suggestionForRoute(pathname, preferred));
  }, [locale, pathname]);

  if (!suggest) return null;

  const dismiss = () => {
    document.cookie = `${DISMISS_COOKIE}=1;path=/;max-age=31536000;SameSite=Lax`;
    setSuggest(null);
  };

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: 'var(--surface)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <a href={getPathname({ href: pathname, locale: suggest })}>
        {t('viewIn', { language: LANGUAGE_LABELS[suggest] })}
      </a>
      <button type="button" onClick={dismiss} aria-label={t('dismiss')}>
        ×
      </button>
    </div>
  );
}
