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
  // 这个页面的 redirect URI（见 lib/oauth-popup-flow.ts）不带 locale 段，永远是
  // `${origin}/oauth/callback`，所以本页始终在默认 locale 下渲染。intl router 的
  // 前缀逻辑只看"当前激活的 locale"，从不看 href 本身；在默认 locale 下它对任何
  // 字符串都是纯 passthrough，不会加前缀，因此也不可能造成双重前缀。
  //
  // 据此：returnTo 有两个互不知情的生产者——AuthModalHost 用原始的、带 locale 前缀
  // 的 pathname，login 页面用裸逻辑路径——两者落到这里都必须原样传给 router，不能
  // 剥离前缀。剥离会把已带前缀的值（如 /ja/community）变成裸路径，而 passthrough
  // 路由器不会补回前缀，用户就此丢失 locale、被导去默认语言页面。带前缀和不带前缀
  // 的值在这里同样正确，交给 router 即可。
  //
  // 与 login/page.tsx 的 stripLocalePrefix 【故意相反】：那里当前 locale 是激活态、
  // router 会加前缀，所以必须剥离；这里是默认 locale passthrough，必须保留。成因就是
  // 「默认 locale passthrough vs. 非默认 locale 主动前缀」这一不对称，别把两处统一。
  //
  // 若未来 redirect URI 加上了 locale 段（本页因此不再总在默认 locale 渲染），这个
  // 结论需要重新评估。
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
