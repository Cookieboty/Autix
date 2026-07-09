'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ActivatePageView } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export default function ActivatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  return (
    <ActivatePageView
      token={token}
      onActivate={(activationToken) => authActions.activate(activationToken)}
      onBackToLogin={() => router.push('/login')}
    />
  );
}
