'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { ToastProvider } from '@heroui/react';
import { TaskSseProvider } from './providers/TaskSseProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TaskSseProvider>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="dark"
            enableSystem={false}
            themes={['light', 'dark']}
          >
            {children}
          </ThemeProvider>
        </TaskSseProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
