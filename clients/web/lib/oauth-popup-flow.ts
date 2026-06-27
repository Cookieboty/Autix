import type { AuthLoginResult } from '@autix/shared-store';
import { authActions } from '@autix/shared-store';
import { getNavigation } from '@autix/platform';
import { openBlankPopup, driveOAuthPopup, newChannel, type OAuthPopupResult } from './oauth-popup';

const SYSTEM_CODE = process.env.NEXT_PUBLIC_SYSTEM_CODE ?? 'chat';
const OAUTH_RETURN_TO_KEY = 'autix.oauth.returnTo';
const GENERIC = 'OAUTH_GENERIC';

export type LoginPopupOutcome =
  | { kind: 'logged-in'; result: AuthLoginResult }
  | { kind: 'redirected' }
  | { kind: 'cancelled' }
  | { kind: 'error'; code: string };

export type LinkPopupOutcome =
  | { kind: 'linked'; linked: string }
  | { kind: 'redirected' }
  | { kind: 'cancelled' }
  | { kind: 'error'; code: string };

type FlowRaw =
  | { kind: 'redirected' }
  | { kind: 'cancelled' }
  | { kind: 'error'; code: string }
  | { kind: 'message'; result: OAuthPopupResult };

// 共用骨架:同步开窗 → 被拦截则回退整页(/oauth/callback)→ 否则取 popup-callback URL → drive。
async function runPopupFlow(
  getUrl: (redirectUri: string) => Promise<{ authorizeUrl: string }>,
  beforeFallbackAssign?: () => void,
): Promise<FlowRaw> {
  const origin = window.location.origin;
  const popup = openBlankPopup();

  if (!popup) {
    beforeFallbackAssign?.();
    const { authorizeUrl } = await getUrl(`${origin}/oauth/callback`);
    getNavigation().assign?.(authorizeUrl);
    return { kind: 'redirected' };
  }

  const channel = newChannel();
  let authorizeUrl: string;
  try {
    ({ authorizeUrl } = await getUrl(`${origin}/oauth/popup-callback?channel=${channel}`));
  } catch {
    popup.close();
    return { kind: 'error', code: GENERIC };
  }

  const result = await driveOAuthPopup(popup, authorizeUrl, channel);
  if (result.cancelled) return { kind: 'cancelled' };
  if (result.error) return { kind: 'error', code: result.error };
  return { kind: 'message', result };
}

export async function loginWithPopup(opts: { provider: string; returnTo: string }): Promise<LoginPopupOutcome> {
  const raw = await runPopupFlow(
    (redirectUri) => authActions.getOAuthAuthorizeUrl({ provider: opts.provider, systemCode: SYSTEM_CODE, redirectUri }),
    () => window.sessionStorage.setItem(OAUTH_RETURN_TO_KEY, opts.returnTo),
  );
  if (raw.kind !== 'message') return raw;
  const code = raw.result.code;
  if (!code) return { kind: 'error', code: GENERIC };
  const result = await authActions.completeOAuthLogin(code);
  return { kind: 'logged-in', result };
}

export async function linkWithPopup(opts: { provider: string }): Promise<LinkPopupOutcome> {
  const raw = await runPopupFlow(
    (redirectUri) => authActions.getLinkAuthorizeUrl(opts.provider, { systemCode: SYSTEM_CODE, redirectUri }),
  );
  if (raw.kind !== 'message') return raw;
  const linked = raw.result.linked;
  if (!linked) return { kind: 'error', code: GENERIC };
  return { kind: 'linked', linked };
}
