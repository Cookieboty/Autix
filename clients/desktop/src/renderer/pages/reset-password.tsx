'use client';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { ResetPasswordPageView } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <ResetPasswordPageView
      token={token}
      onResetPassword={(resetToken, newPassword) =>
        authActions.resetPassword(resetToken, newPassword)
      }
      onBackToLogin={() => navigate('/login')}
    />
  );
}
