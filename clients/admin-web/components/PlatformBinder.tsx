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
      <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
