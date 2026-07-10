'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { LocaleRoutingProvider } from '@autix/shared-ui';
import { getPathname } from '@/i18n/navigation';

export function WebLocaleRouting({ children }: { children: React.ReactNode }) {
  const locale = useLocale();   // hooks 规则：必须在组件顶层调用
  const localize = React.useCallback(
    (p: string) => getPathname({ href: p, locale }),
    [locale],
  );
  return <LocaleRoutingProvider value={localize}>{children}</LocaleRoutingProvider>;
}
