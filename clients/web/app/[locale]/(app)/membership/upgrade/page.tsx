'use client';

import { useRouter } from '@/i18n/navigation';
import { MembershipUpgradeView } from '@autix/shared-ui';

export default function UpgradePage() {
  const router = useRouter();

  return (
    <MembershipUpgradeView
      showSidebarTrigger
      onNavigateOrder={(orderId) => router.push(`/membership/orders/${orderId}`)}
      onCheckoutFallback={() => router.push('/membership/orders')}
    />
  );
}
