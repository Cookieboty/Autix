'use client';

import { useRouter } from '@/i18n/navigation';
import { ForgotPasswordPageView } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export default function ForgotPasswordPage() {
  const router = useRouter();

  return (
    <ForgotPasswordPageView
      onSendResetEmail={(email) => authActions.sendForgotPasswordEmail(email)}
      onBackToLogin={() => router.push('/login')}
    />
  );
}
