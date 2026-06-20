'use client';

import { useRouter } from 'next/navigation';
import { MembershipPackagesView } from '@autix/shared-ui';

export default function PackagesPage() {
  const router = useRouter();

  return (
    <MembershipPackagesView
      showSidebarTrigger
      onNavigateUpgrade={() => router.push('/membership/upgrade')}
      onCheckoutFallback={() => router.push('/membership/orders')}
    />
  );
}
