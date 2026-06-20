'use client';

import { useNavigate } from 'react-router-dom';
import { MembershipPackagesView as SharedMembershipPackagesView } from '@autix/shared-ui';

export function MembershipPackagesPage() {
  const navigate = useNavigate();

  return (
    <SharedMembershipPackagesView
      activeColorVar="--accent"
      descriptionKey="packagesDesc"
      descriptionVariant="plain"
      showPackageDetails={false}
      requirePaidLevel
      disablePurchaseForNonMember={false}
      showOperationErrorToast={false}
      onNavigateUpgrade={() => navigate('/membership/upgrade')}
      onCheckoutFallback={() => navigate('/membership/orders')}
    />
  );
}
