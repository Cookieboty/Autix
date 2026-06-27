import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/community',
  useSearchParams: () => new URLSearchParams(''),
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

  it('logged-in PENDING → replace /pending', async () => {
    loginWithPopup.mockResolvedValue({ kind: 'logged-in', result: { user: { status: 'PENDING' } } });
    await renderHost();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/pending'));
  });

  it('error → 显示 mapOAuthErrorKey 翻译串,不跳转', async () => {
    loginWithPopup.mockResolvedValue({ kind: 'error', code: 'OAUTH_PROVIDER_DENIED' });
    await renderHost();
    fireEvent.click(await screen.findByText('go-google'));
    await waitFor(() => expect(screen.getByTestId('err').textContent).toBe('mapped:OAUTH_PROVIDER_DENIED'));
    expect(replace).not.toHaveBeenCalled();
  });
});
