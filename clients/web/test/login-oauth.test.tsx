import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const loginWithPopup = vi.fn();
vi.mock('@/lib/oauth-popup-flow', () => ({ loginWithPopup: (...a: unknown[]) => loginWithPopup(...a) }));

const fetchOAuthProviders = vi.fn();
vi.mock('@autix/shared-store', () => ({
  authActions: { fetchOAuthProviders: () => fetchOAuthProviders(), login: vi.fn() },
}));

vi.mock('@autix/shared-ui/auth', () => ({
  mapOAuthErrorKey: (c: string) => `mapped:${c}`,
  // 用桩件替代重型视图,只暴露点击 Google 的入口
  LoginPageView: (props: { onOAuthLogin: (p: string) => void; oauthError?: string }) => (
    <div>
      <button onClick={() => props.onOAuthLogin('google')}>go-google</button>
      <span data-testid="err">{props.oauthError}</span>
    </div>
  ),
}));

async function renderPage() {
  const Page = (await import('../app/login/page')).default;
  return render(<Page />);
}

describe('login page OAuth wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchOAuthProviders.mockResolvedValue({ providers: ['google'], comingSoon: [] });
  });

  it('点击 Google → loginWithPopup;logged-in 后 push returnTo', async () => {
    loginWithPopup.mockResolvedValue({ kind: 'logged-in', result: { user: { status: 'ACTIVE' } } });
    await renderPage();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(loginWithPopup).toHaveBeenCalledWith({ provider: 'google', returnTo: '/' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('logged-in PENDING → push /pending', async () => {
    loginWithPopup.mockResolvedValue({ kind: 'logged-in', result: { user: { status: 'PENDING' } } });
    await renderPage();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/pending'));
  });

  it('error → 显示 mapOAuthErrorKey 翻译串', async () => {
    loginWithPopup.mockResolvedValue({ kind: 'error', code: 'OAUTH_PROVIDER_DENIED' });
    await renderPage();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(screen.getByTestId('err').textContent).toBe('mapped:OAUTH_PROVIDER_DENIED'));
    expect(push).not.toHaveBeenCalled();
  });

  it('cancelled → 不 push、不报错', async () => {
    loginWithPopup.mockResolvedValue({ kind: 'cancelled' });
    await renderPage();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(loginWithPopup).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId('err').textContent).toBe('');
  });
});
