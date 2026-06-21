'use client';

import { useRouter } from 'next/navigation';
import { MembershipBenefitsView } from '@autix/shared-ui';

export default function MembershipBenefitsPage() {
  const router = useRouter();

  return (
    <MembershipBenefitsView
      showSidebarTrigger
      onCheckoutFallback={() => router.push('/membership/orders')}
    />
  );
}
