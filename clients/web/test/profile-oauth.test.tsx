import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const invalidateQueries = vi.fn();
const routerReplace = vi.fn();
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ replace: routerReplace }) }));

const linkWithPopup = vi.fn();
vi.mock('@/lib/oauth-popup-flow', () => ({
  linkWithPopup: (...a: unknown[]) => linkWithPopup(...a),
  stepUpWithPopup: vi.fn(),
}));

// 安全（#3）：link/unlink 现在先经 StepUpDialog 换取一次性 proof。stub 成"打开即可点按提供 proof"。
vi.mock('@autix/shared-ui/security', () => ({
  StepUpDialog: (props: { open: boolean; onProof: (p: string) => void }) =>
    props.open ? <button onClick={() => props.onProof('proof-1')}>do-stepup</button> : null,
}));

const fetchOAuthProviders = vi.fn();
let capturedAccountSelfService: { onAccountDeleted: () => void } | undefined;
vi.mock('@autix/shared-store', () => ({
  useProfilePlatformStatsController: () => ({ stats: {} }),
  useAuthStore: () => ({ id: 'u1' }),
  authActions: { fetchOAuthProviders: () => fetchOAuthProviders() },
  useLinkedAccountsQuery: () => ({ data: [] }),
  useUnlinkAccountMutation: () => ({ isPending: false, mutate: vi.fn(), variables: undefined }),
  oauthLinkingKeys: { linked: () => ['oauth', 'linked'] },
}));

vi.mock('@autix/shared-ui/profile', () => ({
  ProfileBasicsForm: () => null,
  ProfileOverviewView: (props: {
    accountSecurity?: { onLink: (p: string) => void; error?: string };
    accountSelfService?: { onAccountDeleted: () => void };
  }) => {
    capturedAccountSelfService = props.accountSelfService;
    return props.accountSecurity ? (
      <div>
        <button onClick={() => props.accountSecurity!.onLink('google')}>link-google</button>
        <span data-testid="link-err">{props.accountSecurity!.error}</span>
      </div>
    ) : null;
  },
}));

async function renderPage() {
  const Page = (await import('../app/[locale]/(app)/profile/page')).default;
  return render(<Page />);
}

describe('profile page link wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedAccountSelfService = undefined;
    fetchOAuthProviders.mockResolvedValue({ providers: ['google'] });
  });

  it('点击绑定 → step-up → linkWithPopup(带 proof);linked 后 invalidate 绑定列表', async () => {
    linkWithPopup.mockResolvedValue({ kind: 'linked', linked: 'google' });
    await renderPage();
    fireEvent.click(await screen.findByText('link-google'));
    fireEvent.click(await screen.findByText('do-stepup'));
    await waitFor(() => expect(linkWithPopup).toHaveBeenCalledWith({ provider: 'google', proof: 'proof-1' }));
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['oauth', 'linked'] }));
  });

  it('redirected/cancelled → 不 invalidate', async () => {
    linkWithPopup.mockResolvedValue({ kind: 'cancelled' });
    await renderPage();
    fireEvent.click(await screen.findByText('link-google'));
    fireEvent.click(await screen.findByText('do-stepup'));
    await waitFor(() => expect(linkWithPopup).toHaveBeenCalled());
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(screen.getByTestId('link-err').textContent).toBe('');
  });

  it('error → 展示绑定错误,不 invalidate', async () => {
    linkWithPopup.mockResolvedValue({ kind: 'error', code: 'OAUTH_PROVIDER_DENIED' });
    await renderPage();
    fireEvent.click(await screen.findByText('link-google'));
    fireEvent.click(await screen.findByText('do-stepup'));
    await waitFor(() => expect(screen.getByTestId('link-err').textContent).toBeTruthy());
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('账号删除成功后替换到登录页', async () => {
    await renderPage();
    expect(capturedAccountSelfService).toBeDefined();

    capturedAccountSelfService!.onAccountDeleted();

    expect(routerReplace).toHaveBeenCalledWith('/login');
  });
});
