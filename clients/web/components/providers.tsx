'use client';

import { Suspense, useEffect, useState } from 'react';
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
        {/* AuthModalHost 读取 useSearchParams，会让所在 Suspense 边界强制 client-render
            （CSR bailout）。它是 root 级组件、在页面槽位边界之外，故必须自带 Suspense
            单独隔离，否则会把整棵静态树拖进客户端渲染。 */}
        <Suspense fallback={null}>
          <AuthModalHost />
        </Suspense>
        <InsufficientPointsGate
          onNavigateOrder={(orderId: string) => router.push(`/orders/${orderId}`)}
        />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
