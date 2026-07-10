import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// login 页面在【当前激活 locale】下渲染，intl router 会对返回值再加一次前缀。因此
// sanitizeReturnTo 必须剥离 returnTo 里已有的 locale 段，交给 router 的永远是裸逻辑路径
// —— 否则 /ja/login + returnTo=/ja/community 会变成 /ja/ja/community → 404。
// router 在此被 mock，断言的是「传给 router 的值」（裸路径），即真实 intl router 只会
// 补一次前缀的输入。
const search = { value: '' };
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));
const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const loginWithPopup = vi.fn();
vi.mock('@/lib/oauth-popup-flow', () => ({
  loginWithPopup: (...a: unknown[]) => loginWithPopup(...a),
}));

const fetchOAuthProviders = vi.fn();
vi.mock('@autix/shared-store', () => ({
  authActions: { fetchOAuthProviders: () => fetchOAuthProviders(), login: vi.fn() },
}));

vi.mock('@autix/shared-ui/auth', () => ({
  mapOAuthErrorKey: (c: string) => `mapped:${c}`,
  LoginPageView: (props: { onOAuthLogin: (p: string) => void }) => (
    <button onClick={() => props.onOAuthLogin('google')}>go-google</button>
  ),
}));

async function renderPage() {
  const Page = (await import('../app/[locale]/login/page')).default;
  return render(<Page />);
}

describe('login returnTo locale 前缀剥离', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchOAuthProviders.mockResolvedValue({ providers: ['google'], comingSoon: [] });
    loginWithPopup.mockResolvedValue({
      kind: 'logged-in',
      result: { user: { status: 'ACTIVE' } },
    });
  });

  it('returnTo=/ja/community → 剥离前缀为 /community（router 只会补一次前缀）', async () => {
    search.value = '?returnTo=/ja/community';
    await renderPage();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() =>
      expect(loginWithPopup).toHaveBeenCalledWith({ provider: 'google', returnTo: '/community' }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/community'));
  });

  it('returnTo=/community（无前缀）→ 保持 /community', async () => {
    search.value = '?returnTo=/community';
    await renderPage();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/community'));
  });

  it('returnTo=/ja/login → 剥离后命中 /login 黑名单，回退到 /', async () => {
    search.value = '?returnTo=/ja/login';
    await renderPage();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() =>
      expect(loginWithPopup).toHaveBeenCalledWith({ provider: 'google', returnTo: '/' }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('returnTo=/ja（仅 locale 段）→ 剥离为根 /', async () => {
    search.value = '?returnTo=/ja';
    await renderPage();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });
});
