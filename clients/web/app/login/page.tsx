'use client';

import { useRouter } from 'next/navigation';
import { LoginPageView, type AuthLoginFormValues } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export default function ChatLoginPage() {
  const router = useRouter();

  return (
    <LoginPageView
      onLogin={(values: AuthLoginFormValues) => authActions.login(values)}
      onPending={() => router.push('/pending')}
      onSuccess={() => router.push('/chat')}
      onForgotPassword={() => router.push('/forgot-password')}
      onRegister={() => router.push('/register')}
    />
  );
}
