'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { LoginPageView, mapOAuthErrorKey, type AuthLoginFormValues, type OAuthProviderId } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';
import { loginWithPopup } from '@/lib/oauth-popup-flow';
import { routing } from '@/i18n/routing';

const LOCALES = routing.locales as readonly string[];

/**
 * 去掉 returnTo 里可能存在的前导 locale 段，还原成 intl router 契约要求的「裸逻辑路径」。
 *
 * 与 oauth/callback 页面的处理【故意相反】，别把两处「统一」了：
 * - login 页面能在任意 locale 下渲染（如 `/ja/login`）。此处的 intl router 会对当前
 *   激活 locale 做前缀。若把已带前缀的 `/ja/community` 原样交给它，会被再加一次前缀 →
 *   `/ja/ja/community` → 404。所以这里必须【剥离】前缀，只留裸路径。
 * - oauth/callback 页面永远在【默认 locale】下渲染，intl router 在那里是纯 passthrough，
 *   带前缀的 returnTo 恰好需要【保留】。剥离反而会把 ja 用户导去英文页（已试过并回退）。
 */
function stripLocalePrefix(value: string): string {
  const firstSeg = value.split('/')[1];
  if (LOCALES.includes(firstSeg)) {
    const rest = value.slice(firstSeg.length + 1);
    return rest === '' ? '/' : rest;
  }
  return value;
}

function sanitizeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  const stripped = stripLocalePrefix(value);
  // 黑名单在【剥离之后】判定：否则 `/ja/login` 绕过 `/login` 规则。
  if (
    stripped.startsWith('/login') ||
    stripped.startsWith('/register') ||
    stripped.startsWith('/oauth/callback')
  ) {
    return null;
  }
  return stripped;
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
