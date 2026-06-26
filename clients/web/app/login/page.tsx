'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoginPageView, type AuthLoginFormValues, type OAuthProviderId } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

const SYSTEM_CODE = process.env.NEXT_PUBLIC_SYSTEM_CODE ?? 'chat';

export default function ChatLoginPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<OAuthProviderId[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProviderId | null>(null);
  const [oauthError, setOAuthError] = useState('');

  useEffect(() => {
    authActions.fetchOAuthProviders().then((list) => setProviders(list as OAuthProviderId[])).catch(() => {});
  }, []);

  const t = useTranslations('auth');

  const onOAuthLogin = (provider: OAuthProviderId) => {
    setLoadingProvider(provider);
    setOAuthError('');
    const redirectUri = `${window.location.origin}/oauth/callback`;
    authActions.startOAuth({ provider, systemCode: SYSTEM_CODE, redirectUri }).catch(() => {
      setLoadingProvider(null);
      setOAuthError(t('oauthGenericError')); // 已翻译串
    });
  };

  return (
    <LoginPageView
      onLogin={(values: AuthLoginFormValues) => authActions.login(values)}
      onPending={() => router.push('/pending')}
      onSuccess={() => router.push('/chat')}
      onForgotPassword={() => router.push('/forgot-password')}
      onRegister={() => router.push('/register')}
      oauthProviders={providers}
      onOAuthLogin={onOAuthLogin}
      oauthLoadingProvider={loadingProvider}
      oauthError={oauthError}
    />
  );
}
