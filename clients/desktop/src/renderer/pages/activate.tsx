'use client';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActivatePageView } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export function ActivatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <ActivatePageView
      token={token}
      variant="card"
      showBrand={false}
      invalidTitleKey="activationTitle"
      successBoxTone="background"
      onActivate={(activationToken) => authActions.activate(activationToken)}
      onBackToLogin={() => navigate('/login', { replace: true })}
    />
  );
}
