'use client';

import { useNavigate } from 'react-router-dom';
import { ForgotPasswordPageView } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  return (
    <ForgotPasswordPageView
      onSendResetEmail={(email) => authActions.sendForgotPasswordEmail(email)}
      onBackToLogin={() => navigate('/login')}
    />
  );
}
