import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const invalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const linkWithPopup = vi.fn();
vi.mock('@/lib/oauth-popup-flow', () => ({ linkWithPopup: (...a: unknown[]) => linkWithPopup(...a) }));

const fetchOAuthProviders = vi.fn();
vi.mock('@autix/shared-store', () => ({
  useProfilePlatformStatsController: () => ({ stats: {} }),
  useAuthStore: () => ({ id: 'u1' }),
  authActions: { fetchOAuthProviders: () => fetchOAuthProviders() },
  useLinkedAccountsQuery: () => ({ data: [] }),
  useUnlinkAccountMutation: () => ({ isPending: false, mutate: vi.fn(), variables: undefined }),
  oauthLinkingKeys: { linked: () => ['oauth', 'linked'] },
}));

vi.mock('@autix/shared-ui/profile', () => ({
  ProfileOverviewView: (props: { accountSecurity?: { onLink: (p: string) => void; error?: string } }) =>
    props.accountSecurity ? (
      <div>
        <button onClick={() => props.accountSecurity!.onLink('google')}>link-google</button>
        <span data-testid="link-err">{props.accountSecurity!.error}</span>
      </div>
    ) : null,
}));

async function renderPage() {
  const Page = (await import('../app/[locale]/(app)/profile/page')).default;
  return render(<Page />);
}

describe('profile page link wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchOAuthProviders.mockResolvedValue({ providers: ['google'] });
  });

  it('点击绑定 → linkWithPopup;linked 后 invalidate 绑定列表', async () => {
    linkWithPopup.mockResolvedValue({ kind: 'linked', linked: 'google' });
    await renderPage();
    fireEvent.click(await screen.findByText('link-google'));
    await waitFor(() => expect(linkWithPopup).toHaveBeenCalledWith({ provider: 'google' }));
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['oauth', 'linked'] }));
  });

  it('redirected/cancelled → 不 invalidate', async () => {
    linkWithPopup.mockResolvedValue({ kind: 'cancelled' });
    await renderPage();
    fireEvent.click(await screen.findByText('link-google'));
    await waitFor(() => expect(linkWithPopup).toHaveBeenCalled());
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(screen.getByTestId('link-err').textContent).toBe('');
  });

  it('error → 展示绑定错误,不 invalidate', async () => {
    linkWithPopup.mockResolvedValue({ kind: 'error', code: 'OAUTH_PROVIDER_DENIED' });
    await renderPage();
    fireEvent.click(await screen.findByText('link-google'));
    await waitFor(() => expect(screen.getByTestId('link-err').textContent).toBeTruthy());
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
