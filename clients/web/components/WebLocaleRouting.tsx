'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { LocaleRoutingProvider, PathnameProvider } from '@autix/shared-ui';
import { getPathname, usePathname } from '@/i18n/navigation';

export function WebLocaleRouting({ children }: { children: React.ReactNode }) {
  const locale = useLocale();   // hooks 规则：必须在组件顶层调用
  const localize = React.useCallback(
    (p: string) => getPathname({ href: p, locale }),
    [locale],
  );
  // next-intl 的 usePathname 已剥离 locale 前缀，且在 SSR / CSR 首帧一致，
  // 通过 PathnameProvider 下发给 shared-ui 的 usePathname，从根源消掉依赖
  // pathname 的组件（如 AssetSidebar 的 active 高亮）hydration mismatch。
  const pathname = usePathname();
  return (
    <LocaleRoutingProvider value={localize}>
      <PathnameProvider value={pathname}>{children}</PathnameProvider>
    </LocaleRoutingProvider>
  );
}
