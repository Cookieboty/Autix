import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const search = { value: '?code=abc' };
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));

// The callback always renders at the default locale (the OAuth redirect URI carries
// no locale segment - see lib/oauth-popup-flow.ts), so the intl router's prefixing
// is a no-op passthrough there. This spy proves whatever string reaches it is passed
// through unchanged - no stripping, no re-prefixing.
const replace = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const completeOAuthLogin = vi.fn();
vi.mock('@autix/shared-store', () => ({
  authActions: { completeOAuthLogin: (...a: unknown[]) => completeOAuthLogin(...a) },
}));
vi.mock('@autix/shared-ui/auth', () => ({
  mapOAuthErrorKey: (c: string) => `mapped:${c}`,
}));

const OAUTH_RETURN_TO_KEY = 'autix.oauth.returnTo';

async function renderPage() {
  const Page = (await import('../app/[locale]/oauth/callback/page')).default;
  return render(<Page />);
}

describe('oauth callback page returnTo routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search.value = '?code=abc';
    window.sessionStorage.clear();
  });

  it('已带 locale 前缀的 returnTo（如 /ja/community）必须原样、不剥离地传给 intl router', async () => {
    // AuthModalHost 把原始的、带前缀的 pathname 存进这个 key；callback 页面渲染时
    // 永远处于默认 locale（redirect URI 不带 locale 段），intl router 在那里是纯
    // passthrough，剥离前缀反而会把 ja 用户导去英文页 —— 这正是本测试要钉住的行为。
    window.sessionStorage.setItem(OAUTH_RETURN_TO_KEY, '/ja/community');
    completeOAuthLogin.mockResolvedValue({ user: { status: 'ACTIVE' } });

    await renderPage();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/ja/community'));
  });
});
