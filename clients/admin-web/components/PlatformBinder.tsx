'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { hydrateStores } from '@autix/shared-store';
import { bindRouter } from '@/lib/platform';

export function PlatformBinder({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  bindRouter(router, pathname);

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
          minHeight: '100vh',
          fontSize: 14,
          color: 'var(--muted)',
        }}
      >
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
