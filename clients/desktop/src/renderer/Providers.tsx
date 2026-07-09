'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@autix/shared-ui/ui';
import { InsufficientPointsGate, LocaleRoutingProvider } from '@autix/shared-ui';
import { hydrateStores, wireInsufficientPointsReporter } from '@autix/shared-store';
import { IntlProvider } from './i18n/IntlProvider';

// desktop 路径无 locale 前缀，"本地化"就是恒等函数——模块级常量，避免每次渲染
// 都创建新的函数引用触发依赖它的组件重渲染。
const identity = (p: string) => p;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
      }),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrateStores().then(() => setHydrated(true));
  }, []);

  useEffect(() => wireInsufficientPointsReporter(), []);

  if (!hydrated) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontSize: 14,
          color: '#999',
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="dark"
        enableSystem={false}
        themes={['light', 'dark']}
      >
        <LocaleRoutingProvider value={identity}>
          <IntlProvider>
            {children}
            <InsufficientPointsGate />
            <Toaster />
          </IntlProvider>
        </LocaleRoutingProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
