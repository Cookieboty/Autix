'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { ToastProvider } from '@heroui/react';
import { hydrateStores } from '@autix/shared-store';
import { IntlProvider } from './i18n/IntlProvider';

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
        <IntlProvider>
          {children}
          <ToastProvider />
        </IntlProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
