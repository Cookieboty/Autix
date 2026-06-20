'use client';

import { useNavigate } from 'react-router-dom';
import { AdminMembershipUsersView } from '@autix/shared-ui/admin';

export function SystemUsersPage() {
  const navigate = useNavigate();
  return <AdminMembershipUsersView onOpenUserDetail={(userId) => navigate(`/system/membership/users/${userId}`)} />;
}
