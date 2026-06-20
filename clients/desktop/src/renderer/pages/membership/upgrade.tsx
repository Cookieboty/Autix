'use client';

import { useNavigate } from 'react-router-dom';
import { MembershipUpgradeView as SharedMembershipUpgradeView } from '@autix/shared-ui';

export function MembershipUpgradePage() {
  const navigate = useNavigate();

  return (
    <SharedMembershipUpgradeView
      activeColorVar="--accent"
      descriptionKey="choosePlan"
      descriptionVariant="plain"
      showDowngradeToast={false}
      showOperationErrorToast={false}
      onCheckoutFallback={() => navigate('/membership/orders')}
    />
  );
}
