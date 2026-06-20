'use client';

import { MembershipOrdersView as SharedMembershipOrdersView } from '@autix/shared-ui';

export function MembershipOrdersPage() {
  return (
    <SharedMembershipOrdersView
      activeColorVar="--accent"
      showPayAction={false}
    />
  );
}
