'use client';

import { useNavigate } from 'react-router-dom';
import { MembershipCenterView as SharedMembershipCenterView } from '@autix/shared-ui';

export function MembershipPage() {
  const navigate = useNavigate();

  return (
    <SharedMembershipCenterView
      activeColorVar="--accent"
      onNavigate={(href) => navigate(href)}
    />
  );
}
