import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Two distinct spies so assertions can prove *which* router fired: mixing a
// prefixed pathname into the wrong router (or vice versa) must fail a test.
const replace = vi.fn(); // raw next/navigation router: takes fully-prefixed URLs
const localeReplace = vi.fn(); // next-intl @/i18n/navigation router: takes bare logical paths
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/community',
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: localeReplace, push: vi.fn() }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const loginWithPopup = vi.fn();
vi.mock('@/lib/oauth-popup-flow', () => ({ loginWithPopup: (...a: unknown[]) => loginWithPopup(...a) }));

const closeAuthModal = vi.fn();
const fetchOAuthProviders = vi.fn();
vi.mock('@autix/shared-store', () => ({
  authActions: {
    fetchOAuthProviders: () => fetchOAuthProviders(),
    login: vi.fn(),
    register: vi.fn(),
    sendForgotPasswordEmail: vi.fn(),
  },
  useUiStore: (sel: (s: unknown) => unknown) =>
    sel({ authModalOpen: true, authModalMode: 'entry', closeAuthModal, setAuthModalMode: vi.fn() }),
}));

vi.mock('@autix/shared-ui/auth', () => ({
  mapOAuthErrorKey: (c: string) => `mapped:${c}`,
  AuthModalView: (props: { onOAuthLogin: (p: string) => void; oauthError?: string }) => (
    <div>
      <button onClick={() => props.onOAuthLogin('google')}>go-google</button>
      <span data-testid="err">{props.oauthError}</span>
    </div>
  ),
}));

async function renderHost() {
  const { AuthModalHost } = await import('../components/AuthModalHost');
  return render(<AuthModalHost />);
}

describe('AuthModalHost OAuth wiring (popup, no full-page redirect)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchOAuthProviders.mockResolvedValue({ providers: ['google'], comingSoon: [] });
    window.sessionStorage.clear();
  });

  it('点击 Google → loginWithPopup;logged-in 后 closeAuthModal + replace 当前路由', async () => {
    loginWithPopup.mockResolvedValue({ kind: 'logged-in', result: { user: { status: 'ACTIVE' } } });
    await renderHost();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() =>
      expect(loginWithPopup).toHaveBeenCalledWith({ provider: 'google', returnTo: '/community' }),
    );
    await waitFor(() => expect(closeAuthModal).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith('/community');
  });

  it('logged-in PENDING → localeRouter.replace /pending（裸路径，走 intl 路由）', async () => {
    loginWithPopup.mockResolvedValue({ kind: 'logged-in', result: { user: { status: 'PENDING' } } });
    await renderHost();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(localeReplace).toHaveBeenCalledWith('/pending'));
    // 关键防回归断言：raw router 绝不能收到这次跳转,否则 locale 会丢失。
    expect(replace).not.toHaveBeenCalledWith('/pending');
  });

  it('error → 显示 mapOAuthErrorKey 翻译串,不跳转', async () => {
    loginWithPopup.mockResolvedValue({ kind: 'error', code: 'OAUTH_PROVIDER_DENIED' });
    await renderHost();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(screen.getByTestId('err').textContent).toBe('mapped:OAUTH_PROVIDER_DENIED'));
    expect(replace).not.toHaveBeenCalled();
  });
});
