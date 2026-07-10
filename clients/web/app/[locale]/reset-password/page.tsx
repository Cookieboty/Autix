'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { ResetPasswordPageView } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  return (
    <ResetPasswordPageView
      token={token}
      onResetPassword={(resetToken, newPassword) =>
        authActions.resetPassword(resetToken, newPassword)
      }
      onBackToLogin={() => router.push('/login')}
    />
  );
}
