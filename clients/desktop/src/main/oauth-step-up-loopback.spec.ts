import { reserveOAuthStepUpLoopback } from './oauth-step-up-loopback';

describe('OAuth step-up loopback', () => {
  it('accepts only the reserved path and state, then closes with proof and purpose', async () => {
    const reservation = await reserveOAuthStepUpLoopback(1_000);
    const callback = new URL(reservation.redirectUri);
    callback.searchParams.set('proof', 'proof-1');
    callback.searchParams.set('purpose', 'delete-account');

    const response = await fetch(callback);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(reservation.result).resolves.toEqual({
      proof: 'proof-1',
      purpose: 'delete-account',
    });
  });

  it('returns a provider link result through the same protected callback channel', async () => {
    const reservation = await reserveOAuthStepUpLoopback(1_000);
    const callback = new URL(reservation.redirectUri);
    callback.searchParams.set('linked', 'google');

    expect((await fetch(callback)).status).toBe(200);
    await expect(reservation.result).resolves.toEqual({ linked: 'google' });
  });

  it('rejects a callback with a mismatched state without settling the flow', async () => {
    const reservation = await reserveOAuthStepUpLoopback(1_000);
    const callback = new URL(reservation.redirectUri);
    callback.searchParams.set('state', 'wrong-state');
    callback.searchParams.set('proof', 'proof-1');
    callback.searchParams.set('purpose', 'change-email');

    expect((await fetch(callback)).status).toBe(404);
    reservation.cancel();
    await expect(reservation.result).rejects.toThrow('OAUTH_STEP_UP_CANCELLED');
  });

  it('propagates provider errors immediately instead of waiting for timeout', async () => {
    const reservation = await reserveOAuthStepUpLoopback(1_000);
    const callback = new URL(reservation.redirectUri);
    callback.searchParams.set('error', 'OAUTH_PROVIDER_DENIED');

    expect((await fetch(callback)).status).toBe(400);
    await expect(reservation.result).rejects.toThrow('OAUTH_PROVIDER_DENIED');
  });

  it('rejects and closes when cancelled or timed out', async () => {
    const cancelled = await reserveOAuthStepUpLoopback(1_000);
    cancelled.cancel();
    await expect(cancelled.result).rejects.toThrow('OAUTH_STEP_UP_CANCELLED');

    const timedOut = await reserveOAuthStepUpLoopback(10);
    await expect(timedOut.result).rejects.toThrow('OAUTH_STEP_UP_TIMEOUT');
  });
});
