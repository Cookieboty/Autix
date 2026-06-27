'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@autix/shared-ui/ui';
import { AuthModalHost } from './AuthModalHost';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="light"
        enableSystem={false}
        themes={['light', 'dark']}
      >
        {children}
        <AuthModalHost />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
