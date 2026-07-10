'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { PendingPageView } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export default function PendingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const activationMode = searchParams.get('activation') === '1';
  const notice = searchParams.get('message') || '';

  return (
    <PendingPageView
      email={email}
      activationMode={activationMode}
      initialNotice={notice}
      onResendActivation={(activationEmail) => authActions.resendActivation(activationEmail)}
      onBackToLogin={() => router.push('/login')}
    />
  );
}
