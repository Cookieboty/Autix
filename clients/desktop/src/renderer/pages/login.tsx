'use client';

import { useNavigate } from 'react-router-dom';
import { LoginPageView, type AuthLoginFormValues } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export function LoginPage() {
  const navigate = useNavigate();

  return (
    <LoginPageView
      onLogin={(values: AuthLoginFormValues) =>
        authActions.login(values, {
          storeProfileCollections: false,
          keepProfileCollectionsOnUser: true,
        })
      }
      onPending={() => navigate('/pending')}
      onSuccess={() => navigate('/chat')}
      onForgotPassword={() => navigate('/forgot-password')}
      onRegister={() => navigate('/register')}
    />
  );
}
