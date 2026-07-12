import { describe, it, expect, vi, beforeEach } from 'vitest';

const getOAuthAuthorizeUrl = vi.fn();
const getLinkAuthorizeUrl = vi.fn();
const completeOAuthLogin = vi.fn();
const startStepUpForOAuth = vi.fn();
vi.mock('@autix/shared-store', () => ({
  authActions: { getOAuthAuthorizeUrl, getLinkAuthorizeUrl, completeOAuthLogin },
  securityActions: { startStepUpForOAuth },
}));

const assign = vi.fn();
vi.mock('@autix/platform', () => ({ getNavigation: () => ({ assign }) }));

const openBlankPopup = vi.fn();
const driveOAuthPopup = vi.fn();
vi.mock('../lib/oauth-popup', () => ({
  openBlankPopup: () => openBlankPopup(),
  driveOAuthPopup: (...a: unknown[]) => driveOAuthPopup(...a),
  newChannel: () => 'CH',
}));

function fakePopup() {
  return { closed: false, close: vi.fn(), location: { href: '' } } as unknown as Window;
}

describe('oauth-popup-flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('loginWithPopup 成功: drive 返回 code → completeOAuthLogin → logged-in', async () => {
    openBlankPopup.mockReturnValue(fakePopup());
    getOAuthAuthorizeUrl.mockResolvedValue({ authorizeUrl: 'https://g/x' });
    driveOAuthPopup.mockResolvedValue({ code: 'LC' });
    completeOAuthLogin.mockResolvedValue({ user: { status: 'ACTIVE' } });
    const { loginWithPopup } = await import('../lib/oauth-popup-flow');
    const out = await loginWithPopup({ provider: 'google', returnTo: '/' });
    expect(getOAuthAuthorizeUrl).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      redirectUri: `${window.location.origin}/oauth/popup-callback?channel=CH`,
    }));
    expect(completeOAuthLogin).toHaveBeenCalledWith('LC');
    expect(out).toEqual({ kind: 'logged-in', result: { user: { status: 'ACTIVE' } } });
  });

  it('loginWithPopup 被拦截: popup=null → 回退 /oauth/callback + assign + 存 returnTo', async () => {
    openBlankPopup.mockReturnValue(null);
    getOAuthAuthorizeUrl.mockResolvedValue({ authorizeUrl: 'https://g/fallback' });
    const { loginWithPopup } = await import('../lib/oauth-popup-flow');
    const out = await loginWithPopup({ provider: 'google', returnTo: '/dash' });
    expect(getOAuthAuthorizeUrl).toHaveBeenCalledWith(expect.objectContaining({
      redirectUri: `${window.location.origin}/oauth/callback`,
    }));
    expect(assign).toHaveBeenCalledWith('https://g/fallback');
    expect(window.sessionStorage.getItem('autix.oauth.returnTo')).toBe('/dash');
    expect(out).toEqual({ kind: 'redirected' });
  });

  it('loginWithPopup 取 URL 失败 → popup.close + error', async () => {
    const popup = fakePopup();
    openBlankPopup.mockReturnValue(popup);
    getOAuthAuthorizeUrl.mockRejectedValue(new Error('boom'));
    const { loginWithPopup } = await import('../lib/oauth-popup-flow');
    const out = await loginWithPopup({ provider: 'google', returnTo: '/' });
    expect((popup.close as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    expect(out).toEqual({ kind: 'error', code: 'OAUTH_GENERIC' });
    expect(completeOAuthLogin).not.toHaveBeenCalled();
  });

  it('loginWithPopup 被拦截且回退取 URL 失败 → 不残留脏 returnTo', async () => {
    openBlankPopup.mockReturnValue(null);
    getOAuthAuthorizeUrl.mockRejectedValue(new Error('boom'));
    const { loginWithPopup } = await import('../lib/oauth-popup-flow');
    await expect(loginWithPopup({ provider: 'google', returnTo: '/dash' })).rejects.toThrow();
    expect(window.sessionStorage.getItem('autix.oauth.returnTo')).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('loginWithPopup 用户取消 → cancelled', async () => {
    openBlankPopup.mockReturnValue(fakePopup());
    getOAuthAuthorizeUrl.mockResolvedValue({ authorizeUrl: 'u' });
    driveOAuthPopup.mockResolvedValue({ cancelled: true });
    const { loginWithPopup } = await import('../lib/oauth-popup-flow');
    expect(await loginWithPopup({ provider: 'google', returnTo: '/' })).toEqual({ kind: 'cancelled' });
  });

  it('loginWithPopup provider error → error code', async () => {
    openBlankPopup.mockReturnValue(fakePopup());
    getOAuthAuthorizeUrl.mockResolvedValue({ authorizeUrl: 'u' });
    driveOAuthPopup.mockResolvedValue({ error: 'OAUTH_PROVIDER_DENIED' });
    const { loginWithPopup } = await import('../lib/oauth-popup-flow');
    expect(await loginWithPopup({ provider: 'google', returnTo: '/' })).toEqual({ kind: 'error', code: 'OAUTH_PROVIDER_DENIED' });
  });

  it('linkWithPopup 成功: drive 返回 linked → linked', async () => {
    openBlankPopup.mockReturnValue(fakePopup());
    getLinkAuthorizeUrl.mockResolvedValue({ authorizeUrl: 'https://g/link' });
    driveOAuthPopup.mockResolvedValue({ linked: 'google' });
    const { linkWithPopup } = await import('../lib/oauth-popup-flow');
    const out = await linkWithPopup({ provider: 'google', proof: 'proof-1' });
    expect(getLinkAuthorizeUrl).toHaveBeenCalledWith('google', expect.objectContaining({
      redirectUri: `${window.location.origin}/oauth/popup-callback?channel=CH`,
    }));
    expect(out).toEqual({ kind: 'linked', linked: 'google' });
  });

  it('linkWithPopup 被拦截 → 回退 /oauth/callback + assign(不存 returnTo)', async () => {
    openBlankPopup.mockReturnValue(null);
    getLinkAuthorizeUrl.mockResolvedValue({ authorizeUrl: 'https://g/linkfb' });
    const { linkWithPopup } = await import('../lib/oauth-popup-flow');
    const out = await linkWithPopup({ provider: 'google', proof: 'proof-1' });
    expect(getLinkAuthorizeUrl).toHaveBeenCalledWith('google', expect.objectContaining({
      redirectUri: `${window.location.origin}/oauth/callback`,
    }));
    expect(assign).toHaveBeenCalledWith('https://g/linkfb');
    expect(window.sessionStorage.getItem('autix.oauth.returnTo')).toBeNull();
    expect(out).toEqual({ kind: 'redirected' });
  });

  it('stepUpWithPopup 被拦截时仍请求服务端并允许进入 OTP', async () => {
    openBlankPopup.mockReturnValue(null);
    const otp = {
      kind: 'otp',
      channel: 'email',
      maskedTarget: 'a***@example.com',
      requestId: 'otp-1',
      resendCooldownSeconds: 60,
      expiresAt: '2026-07-12T01:00:00.000Z',
    } as const;
    startStepUpForOAuth.mockResolvedValue(otp);
    const { stepUpWithPopup } = await import('../lib/oauth-popup-flow');

    await expect(stepUpWithPopup('delete-account')).resolves.toEqual(otp);
    expect(startStepUpForOAuth).toHaveBeenCalledWith(expect.objectContaining({
      purpose: 'delete-account',
      clientType: 'web',
      redirectUri: `${window.location.origin}/oauth/callback`,
      preferEmailOtp: true,
    }));
  });

  it('stepUpWithPopup 被拦截且服务端选择 OAuth 时返回 redirect 供用户二次点击开窗', async () => {
    openBlankPopup.mockReturnValue(null);
    const redirect = {
      kind: 'redirect',
      provider: 'google',
      authorizeUrl: 'https://g/reauth',
      state: 'state-1',
      expiresAt: '2026-07-12T01:00:00.000Z',
    } as const;
    startStepUpForOAuth.mockResolvedValue(redirect);
    const { stepUpWithPopup } = await import('../lib/oauth-popup-flow');

    await expect(stepUpWithPopup('delete-account')).resolves.toEqual(redirect);
    expect(driveOAuthPopup).not.toHaveBeenCalled();
  });

});
