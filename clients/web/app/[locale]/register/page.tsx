'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { RegisterPageView, type AuthRegisterFormValues } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
        router.push(
          `/pending?activation=1&email=${encodeURIComponent(email)}&message=${encodeURIComponent(message)}`,
        );
      }}
      onPending={() => router.push('/pending')}
      onLogin={() => router.push('/login')}
    />
  );
}
