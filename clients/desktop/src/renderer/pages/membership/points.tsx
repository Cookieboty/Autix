'use client';

import { MembershipPointsView as SharedMembershipPointsView } from '@autix/shared-ui';

export function MembershipPointsPage() {
  return (
    <SharedMembershipPointsView
      activeColorVar="--accent"
      variant="balance"
    />
  );
}
