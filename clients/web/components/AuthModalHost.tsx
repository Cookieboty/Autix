'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AuthModalView,
  type AuthLoginFormValues,
  type AuthRegisterFormValues,
  type OAuthProviderId,
} from '@autix/shared-ui/auth';
import { authActions, useUiStore } from '@autix/shared-store';

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

export function AuthModalHost() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const open = useUiStore((state) => state.authModalOpen);
  const mode = useUiStore((state) => state.authModalMode);
  const closeAuthModal = useUiStore((state) => state.closeAuthModal);
  const setAuthModalMode = useUiStore((state) => state.setAuthModalMode);
  const [providers, setProviders] = useState<OAuthProviderId[]>([]);
  const [comingSoon, setComingSoon] = useState<OAuthProviderId[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProviderId | null>(null);
  const [oauthError, setOAuthError] = useState('');

  useEffect(() => {
    if (!open) return;
    authActions
      .fetchOAuthProviders()
      .then(({ providers: list, comingSoon: cs }) => {
        setProviders(list as OAuthProviderId[]);
        setComingSoon(cs as OAuthProviderId[]);
      })
      .catch(() => {});
  }, [open]);

  const currentRoute =
    pathname +
    (searchParams.toString() ? `?${searchParams.toString()}` : '') +
    (typeof window === 'undefined' ? '' : window.location.hash);

  const getReturnToCurrentRoute = () => sanitizeReturnTo(currentRoute) ?? '/';

  const onOAuthLogin = (provider: OAuthProviderId) => {
    setLoadingProvider(provider);
    setOAuthError('');
    window.sessionStorage.setItem(OAUTH_RETURN_TO_KEY, getReturnToCurrentRoute());
    const redirectUri = `${window.location.origin}/oauth/callback`;
    authActions
      .startOAuth({ provider, systemCode: SYSTEM_CODE, redirectUri })
      .catch(() => {
        window.sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
        setOAuthError(t('oauthGenericError'));
      })
      .finally(() => setLoadingProvider(null));
  };

  const handleSuccess = () => {
    closeAuthModal();
    router.replace(getReturnToCurrentRoute());
  };

  return (
    <AuthModalView
      open={open}
      mode={mode}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeAuthModal();
      }}
      onModeChange={setAuthModalMode}
      onLogin={(values: AuthLoginFormValues) => authActions.login(values)}
      onLoginSuccess={handleSuccess}
      onPending={() => {
        closeAuthModal();
        router.push('/pending');
      }}
      onRegister={(values: AuthRegisterFormValues) =>
        authActions.register({
          username: values.username,
          email: values.email,
          password: values.password,
          systemCode: SYSTEM_CODE,
          inviteCode: values.inviteCode || undefined,
        })
      }
      onRequiresActivation={(email, message) => {
        closeAuthModal();
        router.push(
          `/pending?activation=1&email=${encodeURIComponent(email)}&message=${encodeURIComponent(message)}`,
        );
      }}
      onSendResetEmail={(email) => authActions.sendForgotPasswordEmail(email)}
      oauthProviders={providers}
      oauthComingSoon={comingSoon}
      onOAuthLogin={onOAuthLogin}
      oauthLoadingProvider={loadingProvider}
      oauthError={oauthError}
    />
  );
}
