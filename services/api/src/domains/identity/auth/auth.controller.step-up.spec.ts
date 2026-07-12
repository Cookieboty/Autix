import { AuthController } from './auth.controller';

function makeController() {
  const stepUp = {
    assertPasswordlessUser: jest.fn().mockResolvedValue(undefined),
    requestOtp: jest.fn().mockResolvedValue({ kind: 'otp', requestId: 'otp-1' }),
  };
  const oauth = {
    startReauth: jest.fn().mockResolvedValue({
      kind: 'redirect',
      provider: 'google',
      authorizeUrl: 'https://example.com/reauth',
    }),
  };
  const controller = new AuthController(
    {} as never,
    {} as never,
    stepUp as never,
    oauth as never,
    {} as never,
  );
  return { controller, stepUp, oauth };
}

describe('AuthController.stepUpAuthorize', () => {
  const user = { id: 'u1', sessionId: 'session-1' } as never;

  it('prefers verified-email OTP when the client reports a blocked popup', async () => {
    const { controller, stepUp, oauth } = makeController();

    await expect(controller.stepUpAuthorize(user, {
      purpose: 'delete-account',
      clientType: 'web',
      redirectUri: 'https://app.example.com/oauth/callback',
      preferEmailOtp: true,
    }, { ip: '127.0.0.1' } as never)).resolves.toMatchObject({ kind: 'otp', requestId: 'otp-1' });

    expect(oauth.startReauth).not.toHaveBeenCalled();
    expect(stepUp.assertPasswordlessUser).toHaveBeenCalledWith('u1');
    expect(stepUp.requestOtp).toHaveBeenCalledWith('u1', 'delete-account', 'session-1', '127.0.0.1');
  });

  it('keeps provider re-auth as the default when popup transport is available', async () => {
    const { controller, stepUp, oauth } = makeController();

    await expect(controller.stepUpAuthorize(user, {
      purpose: 'delete-account',
      clientType: 'web',
      redirectUri: 'https://app.example.com/oauth/popup-callback?channel=ch',
    }, { ip: '127.0.0.1' } as never)).resolves.toMatchObject({ kind: 'redirect', provider: 'google' });

    expect(oauth.startReauth).toHaveBeenCalled();
    expect(stepUp.requestOtp).not.toHaveBeenCalled();
  });

  it('rejects password users before starting OAuth or OTP fallback', async () => {
    const { controller, stepUp, oauth } = makeController();
    stepUp.assertPasswordlessUser.mockRejectedValueOnce(new Error('STEP_UP_REQUIRED'));

    await expect(controller.stepUpAuthorize(user, {
      purpose: 'delete-account',
      clientType: 'web',
      redirectUri: 'https://app.example.com/oauth/popup-callback?channel=ch',
    }, { ip: '127.0.0.1' } as never)).rejects.toThrow('STEP_UP_REQUIRED');

    expect(oauth.startReauth).not.toHaveBeenCalled();
    expect(stepUp.requestOtp).not.toHaveBeenCalled();
  });
});
