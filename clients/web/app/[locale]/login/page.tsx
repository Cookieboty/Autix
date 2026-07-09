'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoginPageView, mapOAuthErrorKey, type AuthLoginFormValues, type OAuthProviderId } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';
import { loginWithPopup } from '@/lib/oauth-popup-flow';

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
    loginWithPopup({ provider, returnTo })
      .then((outcome) => {
        if (outcome.kind === 'logged-in') {
          router.push(outcome.result.user?.status === 'PENDING' ? '/pending' : returnTo);
        } else if (outcome.kind === 'error') {
          setOAuthError(t(mapOAuthErrorKey(outcome.code)));
        }
        // redirected: 页面已整页跳走;cancelled: 静默
      })
      .catch(() => setOAuthError(t('oauthGenericError')))
      .finally(() => setLoadingProvider(null));
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
