'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { normalizeLang, LANGUAGE_LABELS, type SupportedLanguage } from '@autix/i18n';
import { usePathname, getPathname } from '@/i18n/navigation';

const DISMISS_COOKIE = 'locale-hint-dismissed';

/**
 * 纯客户端组件：`localeDetection: false` 下裸路径不会按 Accept-Language 重定向，
 * 这里用 `navigator.language` 在客户端补一层人性化提示，不读 `headers()`（会强制
 * 该路由退出静态渲染 —— 见 Task 12 简报）。
 *
 * 首屏（服务端渲染 + 客户端 hydrate 前）恒定渲染 null，避免 hydration mismatch；
 * 横幅只在挂载后的 effect 里依据 cookie + navigator.language 决定是否出现，
 * 因此不会在首次绘制时占位造成布局位移。
 */
export function LocaleHint() {
  const locale = useLocale() as SupportedLanguage;
  const pathname = usePathname();
  const t = useTranslations('localeHint');
  const [suggest, setSuggest] = React.useState<SupportedLanguage | null>(null);

  React.useEffect(() => {
    if (document.cookie.includes(`${DISMISS_COOKIE}=1`)) return;
    const preferred = normalizeLang(navigator.language);
    if (preferred && preferred !== locale) setSuggest(preferred);
  }, [locale]);

  if (!suggest) return null;

  const dismiss = () => {
    document.cookie = `${DISMISS_COOKIE}=1;path=/;max-age=31536000;SameSite=Lax`;
    setSuggest(null);
  };

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm"
      style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
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
