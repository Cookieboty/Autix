'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRouter as useLocaleRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  AuthModalView,
  mapOAuthErrorKey,
  type AuthLoginFormValues,
  type AuthRegisterFormValues,
  type OAuthProviderId,
} from '@autix/shared-ui/auth';
import { authActions, useUiStore } from '@autix/shared-store';
import { loginWithPopup } from '@/lib/oauth-popup-flow';

const SYSTEM_CODE = process.env.NEXT_PUBLIC_SYSTEM_CODE ?? 'chat';

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
  // raw router: navigates to the fully-prefixed returnTo string (a real URL, not a logical path)
  const router = useRouter();
  // intl router: takes bare logical paths (e.g. /pending) and adds the active locale prefix
  const localeRouter = useLocaleRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const open = useUiStore((state) => state.authModalOpen);
  const mode = useUiStore((state) => state.authModalMode);
  const closeAuthModal = useUiStore((state) => state.closeAuthModal);
  const setAuthModalMode = useUiStore((state) => state.setAuthModalMode);
  const [providers, setProviders] = useState<OAuthProviderId[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProviderId | null>(null);
  const [oauthError, setOAuthError] = useState('');

  useEffect(() => {
    if (!open) return;
    authActions
      .fetchOAuthProviders()
      .then(({ providers: list }) => {
        setProviders(list as OAuthProviderId[]);
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
    const returnTo = getReturnToCurrentRoute();
    loginWithPopup({ provider, returnTo })
      .then((outcome) => {
        if (outcome.kind === 'logged-in') {
          closeAuthModal();
          if (outcome.result.user?.status === 'PENDING') {
            localeRouter.replace('/pending'); // bare logical path -> locale-prefixed
          } else {
            router.replace(returnTo); // returnTo is already a fully-prefixed URL
          }
        } else if (outcome.kind === 'error') {
          setOAuthError(t(mapOAuthErrorKey(outcome.code)));
        }
        // redirected: 页面已整页跳走;cancelled: 静默
      })
      .catch(() => setOAuthError(t('oauthGenericError')))
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
        localeRouter.push('/pending');
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
        localeRouter.push(
          `/pending?activation=1&email=${encodeURIComponent(email)}&message=${encodeURIComponent(message)}`,
        );
      }}
      onSendResetEmail={(email) => authActions.sendForgotPasswordEmail(email)}
      oauthProviders={providers}
      onOAuthLogin={onOAuthLogin}
      oauthLoadingProvider={loadingProvider}
      oauthError={oauthError}
    />
  );
}
