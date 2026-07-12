import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const navigate = mock(() => {});
const reserve = mock(async () => ({
  flowId: 'desktop-flow',
  redirectUri: 'http://127.0.0.1:51789/callback?state=desktop-flow',
}));
const cancel = mock(async () => {});
const complete = mock(async () => ({ proof: 'desktop-proof' }));
const startStepUpForOAuth = mock(async () => ({
  kind: 'redirect' as const,
  authorizeUrl: 'https://accounts.example.test/authorize',
}));

let capturedProfileProps: Record<string, unknown> | undefined;

mock.module('react-router-dom', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams(), mock(() => {})],
}));

mock.module('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mock(async () => {}) }),
}));

mock.module('@autix/shared-ui/profile', () => ({
  DEFAULT_PROFILE_TABS: [{ key: 'acquired', label: 'Acquired' }],
  ProfileBasicsForm: () => createElement('div'),
  ProfileView: (props: Record<string, unknown>) => {
    capturedProfileProps = props;
    return createElement('div');
  },
  isProfileResourceTab: () => true,
}));

mock.module('@autix/shared-ui/resources', () => ({
  useProfileResourceRows: () => [],
}));

mock.module('@autix/shared-ui/marketplace', () => ({
  RESOURCE_TYPE_TO_SLUG: {},
}));

mock.module('@autix/shared-ui/hooks', () => ({
  useSystemFeatureFlag: () => ({ enabled: false, loading: false }),
}));

mock.module('@autix/shared-ui/auth', () => ({
  mapOAuthErrorKey: (code: string) => code,
}));

mock.module('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

mock.module('@autix/shared-store', () => ({
  membershipUserActions: {
    getMe: mock(async () => null),
    getInviteCode: mock(async () => null),
  },
  authActions: {
    fetchOAuthProviders: mock(async () => ({ providers: [] })),
  },
  oauthLinkingKeys: {
    linked: () => ['oauth', 'linked'],
  },
  securityActions: {
    startStepUpForOAuth,
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
    mutate: mock(() => {}),
  }),
  useProfilePlatformStatsController: () => ({ stats: {} }),
  useProfileResourcesController: () => ({ items: [], loading: false }),
}));

mock.module('@autix/platform', () => ({
  getOAuthLink: () => undefined,
  getOAuthStepUp: () => ({ reserve, cancel, complete }),
}));

let ProfilePage: () => ReactNode;

beforeAll(async () => {
  ({ ProfilePage } = await import('../src/renderer/pages/profile'));
});

beforeEach(() => {
  capturedProfileProps = undefined;
  navigate.mockClear();
  reserve.mockClear();
  cancel.mockClear();
  complete.mockClear();
  startStepUpForOAuth.mockClear();
});

describe('desktop profile account self-service wiring', () => {
  it('passes the current account contract and replaces history after deletion', () => {
    renderToStaticMarkup(createElement(ProfilePage));

    const accountSelfService = capturedProfileProps?.accountSelfService as {
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

    const accountSelfService = capturedProfileProps?.accountSelfService as {
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
