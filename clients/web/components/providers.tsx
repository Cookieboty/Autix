'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@autix/shared-ui/ui';
import { InsufficientPointsGate } from '@autix/shared-ui';
import { wireInsufficientPointsReporter } from '@autix/shared-store';
import { AuthModalHost } from './AuthModalHost';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();
  useEffect(() => wireInsufficientPointsReporter(), []);
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
        <InsufficientPointsGate
          onNavigateOrder={(orderId: string) => router.push(`/orders/${orderId}`)}
        />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
