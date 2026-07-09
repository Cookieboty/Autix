'use client';

import { useRouter } from '@/i18n/navigation';
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
