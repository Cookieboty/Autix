'use client';

import { useNavigate, useParams } from 'react-router-dom';
import { AdminMembershipUserDetailView } from '@autix/shared-ui/admin';

export function SystemUserDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const userId = params.id as string;
  return <AdminMembershipUserDetailView userId={userId} onBack={() => navigate('/system/membership/users')} />;
}
