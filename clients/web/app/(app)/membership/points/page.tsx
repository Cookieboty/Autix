'use client';

import { useRouter } from 'next/navigation';
import { MembershipPointsView } from '@autix/shared-ui';

export default function PointsHistoryPage() {
  const router = useRouter();

  return (
    <MembershipPointsView
      showSidebarTrigger
      showRewardsAction
      onNavigateRewards={() => router.push('/membership/rewards')}
    />
  );
}
