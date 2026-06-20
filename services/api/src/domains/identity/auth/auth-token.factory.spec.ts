import { AuthTokenFactory } from './auth-token.factory';

function withEnv<T>(env: Record<string, string | undefined>, run: () => T): T {
  const previous = {
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN,
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe('AuthTokenFactory', () => {
  it('creates token pairs with configured access ttl', () => {
    withEnv({ JWT_ACCESS_EXPIRES_IN: '15m', JWT_REFRESH_EXPIRES_IN: '2d' }, () => {
      const jwt = { sign: jest.fn().mockReturnValue('signed-access-token') } as any;
      const factory = new AuthTokenFactory(jwt);

      const pair = factory.createTokenPair(
        { sub: 'user-1', username: 'alice', sessionId: 'session-1' },
        'refresh-token',
      );

      expect(pair).toEqual({
        accessToken: 'signed-access-token',
        refreshToken: 'refresh-token',
        expiresIn: 15 * 60,
      });
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        username: 'alice',
        sessionId: 'session-1',
      });
    });
  });

  it('creates refresh expirations from configured refresh ttl', () => {
    withEnv({ JWT_ACCESS_EXPIRES_IN: undefined, JWT_REFRESH_EXPIRES_IN: '2h' }, () => {
      const factory = new AuthTokenFactory({ sign: jest.fn() } as any);
      const now = new Date('2026-06-20T00:00:00.000Z').getTime();

      expect(factory.createRefreshExpiresAt(now)).toEqual(
        new Date('2026-06-20T02:00:00.000Z'),
      );
    });
  });

  it('falls back when duration env is invalid', () => {
    withEnv({ JWT_ACCESS_EXPIRES_IN: 'not-a-duration', JWT_REFRESH_EXPIRES_IN: '0s' }, () => {
      const factory = new AuthTokenFactory({ sign: jest.fn().mockReturnValue('access') } as any);

      expect(factory.createTokenPair(
        { sub: 'user-1', username: 'alice', sessionId: 'session-1' },
        'refresh',
      ).expiresIn).toBe(24 * 60 * 60);
      expect(factory.refreshTokenTtlMs).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });
});
