'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { authActions } from '@autix/shared-store';
import { mapOAuthErrorKey } from '@autix/shared-ui/auth';

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

function consumeOAuthReturnTo() {
  const value = sanitizeReturnTo(window.sessionStorage.getItem(OAUTH_RETURN_TO_KEY));
  window.sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
  return value;
}

export default function OAuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations('auth');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // 防 StrictMode 双跑导致一次性码被消费两次
    ran.current = true;
    const linked = params.get('linked');
    if (linked) {
      const allowedProviders = ['google', 'apple', 'github'];
      if (allowedProviders.includes(linked)) {
        router.replace('/profile?linked=' + encodeURIComponent(linked));
      } else {
        router.replace('/profile');
      }
      return;
    }
    const error = params.get('error');
    const code = params.get('code');
    if (error) { setErrorKey(mapOAuthErrorKey(error)); return; }
    if (!code) { setErrorKey('oauthGenericError'); return; }
    authActions
      .completeOAuthLogin(code)
      .then((r) => router.replace(r.user?.status === 'PENDING' ? '/pending' : consumeOAuthReturnTo() ?? '/'))
      .catch(() => setErrorKey('oauthExpired'));
  }, [params, router]);

  if (errorKey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-500">{t(errorKey)}</p>
        <button className="underline" onClick={() => router.replace('/login')}>{t('backToLogin')}</button>
      </div>
    );
  }
  return <div className="flex min-h-screen items-center justify-center">{t('oauthCompleting')}</div>;
}
