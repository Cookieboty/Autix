'use client';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { RegisterPageView, type AuthRegisterFormValues } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('aff') || '';

  return (
    <RegisterPageView
      inviteCode={refCode}
      onRegister={(values: AuthRegisterFormValues) =>
        authActions.register({
          username: values.username,
          email: values.email,
          password: values.password,
          systemCode: 'chat',
          inviteCode: values.inviteCode || undefined,
        })
      }
      onRequiresActivation={(email, message) => {
        navigate(
          `/pending?activation=1&email=${encodeURIComponent(email)}&message=${encodeURIComponent(message)}`,
        );
      }}
      onPending={() => navigate('/pending')}
      onLogin={() => navigate('/login')}
    />
  );
}
