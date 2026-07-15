import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// vi.mock is hoisted above this module's bindings, so its factories cannot close
// over plain consts — vi.hoisted lifts the spies (and the props capture slot) up
// with them. `captured` stays a mutable holder so the factory can write to it.
const h = vi.hoisted(() => ({
  navigate: vi.fn(() => {}),
  reserve: vi.fn(async () => ({
    flowId: 'desktop-flow',
    redirectUri: 'http://127.0.0.1:51789/callback?state=desktop-flow',
  })),
  cancel: vi.fn(async () => {}),
  complete: vi.fn(async () => ({ proof: 'desktop-proof' })),
  startStepUpForOAuth: vi.fn(async () => ({
    kind: 'redirect' as const,
    authorizeUrl: 'https://accounts.example.test/authorize',
  })),
  captured: { profileProps: undefined as Record<string, unknown> | undefined },
}));

const { navigate, reserve, cancel, complete, startStepUpForOAuth, captured } = h;

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn(() => {})],
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn(async () => {}) }),
}));

vi.mock('@autix/shared-ui/profile', () => ({
  DEFAULT_PROFILE_TABS: [{ key: 'acquired', label: 'Acquired' }],
  ProfileBasicsForm: () => createElement('div'),
  ProfileView: (props: Record<string, unknown>) => {
    h.captured.profileProps = props;
    return createElement('div');
  },
  isProfileResourceTab: () => true,
}));

vi.mock('@autix/shared-ui/resources', () => ({
  useProfileResourceRows: () => [],
}));

vi.mock('@autix/shared-ui/marketplace', () => ({
  RESOURCE_TYPE_TO_SLUG: {},
}));

vi.mock('@autix/shared-ui/hooks', () => ({
  useSystemFeatureFlag: () => ({ enabled: false, loading: false }),
}));

vi.mock('@autix/shared-ui/auth', () => ({
  mapOAuthErrorKey: (code: string) => code,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@autix/shared-store', () => ({
  membershipUserActions: {
    getMe: vi.fn(async () => null),
    getInviteCode: vi.fn(async () => null),
  },
  authActions: {
    fetchOAuthProviders: vi.fn(async () => ({ providers: [] })),
  },
  oauthLinkingKeys: {
    linked: () => ['oauth', 'linked'],
  },
  securityActions: {
    startStepUpForOAuth: h.startStepUpForOAuth,
  },
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    user: {
      id: 'desktop-user',
      username: 'desktop_user',
      email: 'desktop@example.test',
      pendingEmail: 'pending@example.test',
      hasPassword: true,
    },
  }),
  useLinkedAccountsQuery: () => ({ data: [] }),
  useUnlinkAccountMutation: () => ({
    isPending: false,
    variables: undefined,
    mutate: vi.fn(() => {}),
  }),
  useProfilePlatformStatsController: () => ({ stats: {} }),
  useProfileResourcesController: () => ({ items: [], loading: false }),
}));

vi.mock('@autix/platform', () => ({
  getOAuthLink: () => undefined,
  getOAuthStepUp: () => ({ reserve: h.reserve, cancel: h.cancel, complete: h.complete }),
}));

let ProfilePage: () => ReactNode;

beforeAll(async () => {
  ({ ProfilePage } = await import('../src/renderer/pages/profile'));
});

beforeEach(() => {
  captured.profileProps = undefined;
  navigate.mockClear();
  reserve.mockClear();
  cancel.mockClear();
  complete.mockClear();
  startStepUpForOAuth.mockClear();
});

describe('desktop profile account self-service wiring', () => {
  it('passes the current account contract and replaces history after deletion', () => {
    renderToStaticMarkup(createElement(ProfilePage));

    const accountSelfService = captured.profileProps?.accountSelfService as {
      currentEmail: string;
      pendingEmail: string;
      hasPassword: boolean;
      currentUsername: string;
      onAccountDeleted: () => void;
    };

    expect(accountSelfService).toMatchObject({
      currentEmail: 'desktop@example.test',
      pendingEmail: 'pending@example.test',
      hasPassword: true,
      currentUsername: 'desktop_user',
    });

    accountSelfService.onAccountDeleted();
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('runs OAuth step-up through the desktop loopback adapter', async () => {
    renderToStaticMarkup(createElement(ProfilePage));

    const accountSelfService = captured.profileProps?.accountSelfService as {
      startOAuthStepUp: (purpose: 'delete-account') => Promise<unknown>;
    };
    await expect(accountSelfService.startOAuthStepUp('delete-account')).resolves.toEqual({
      kind: 'proof',
      proof: 'desktop-proof',
    });

    expect(reserve).toHaveBeenCalledWith('auto');
    expect(startStepUpForOAuth).toHaveBeenCalledWith({
      purpose: 'delete-account',
      clientType: 'desktop',
      redirectUri: 'http://127.0.0.1:51789/callback?state=desktop-flow',
    });
    expect(complete).toHaveBeenCalledWith({
      flowId: 'desktop-flow',
      authorizeUrl: 'https://accounts.example.test/authorize',
      expectedPurpose: 'delete-account',
    });
    expect(cancel).not.toHaveBeenCalled();
  });
});
