'use client';

import { useRouter } from 'next/navigation';
import { MembershipUpgradeView } from '@autix/shared-ui';

export default function UpgradePage() {
  const router = useRouter();

  return (
    <MembershipUpgradeView
      showSidebarTrigger
      onCheckoutFallback={() => router.push('/membership/orders')}
    />
  );
}
