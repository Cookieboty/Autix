'use client';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { PendingPageView } from '@autix/shared-ui/auth';
import { authActions, useAuthStore } from '@autix/shared-store';

export function PendingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logout } = useAuthStore();
  const email = searchParams.get('email') || '';
  const activationMode = searchParams.get('activation') === '1';
  const notice = searchParams.get('message') || '';

  const handleBack = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <PendingPageView
      email={email}
      activationMode={activationMode}
      initialNotice={notice}
      onResendActivation={(activationEmail) => authActions.resendActivation(activationEmail)}
      onBackToLogin={handleBack}
    />
  );
}
