'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoginPageView, type AuthLoginFormValues, type OAuthProviderId } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';

const SYSTEM_CODE = process.env.NEXT_PUBLIC_SYSTEM_CODE ?? 'chat';
const OAUTH_RETURN_TO_KEY = 'autix.oauth.returnTo';

function sanitizeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (
    value.startsWith('/login') ||
    value.startsWith('/register') ||
    value.startsWith('/oauth/callback')
  ) {
    return null;
  }
  return value;
}

export default function ChatLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<OAuthProviderId[]>([]);
  const [comingSoon, setComingSoon] = useState<OAuthProviderId[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProviderId | null>(null);
  const [oauthError, setOAuthError] = useState('');

  useEffect(() => {
    authActions.fetchOAuthProviders().then(({ providers: list, comingSoon: cs }) => {
      setProviders(list as OAuthProviderId[]);
      setComingSoon(cs as OAuthProviderId[]);
    }).catch(() => {});
  }, []);

  const t = useTranslations('auth');
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo')) ?? '/';

  const onOAuthLogin = (provider: OAuthProviderId) => {
    setLoadingProvider(provider);
    setOAuthError('');
    window.sessionStorage.setItem(OAUTH_RETURN_TO_KEY, returnTo);
    const redirectUri = `${window.location.origin}/oauth/callback`;
    authActions.startOAuth({ provider, systemCode: SYSTEM_CODE, redirectUri }).catch(() => {
      window.sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
      setOAuthError(t('oauthGenericError')); // 已翻译串
    }).finally(() => setLoadingProvider(null));
  };

  return (
    <LoginPageView
      onLogin={(values: AuthLoginFormValues) => authActions.login(values)}
      onPending={() => router.push('/pending')}
      onSuccess={() => router.push(returnTo)}
      onForgotPassword={() => router.push('/forgot-password')}
      onRegister={() => router.push('/register')}
      oauthProviders={providers}
      oauthComingSoon={comingSoon}
      onOAuthLogin={onOAuthLogin}
      oauthLoadingProvider={loadingProvider}
      oauthError={oauthError}
    />
  );
}
