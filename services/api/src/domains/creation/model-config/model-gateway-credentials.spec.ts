import {
  resolveApiKey,
  resolveBaseUrl,
  resolveModelCredentials,
} from './model-gateway-credentials';

const ENV_KEYS = ['AMUX_API_KEY', 'AMUX_BASE_URL'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('resolveApiKey', () => {
  it('prefers a non-empty model_configs value over metadata and env', () => {
    process.env.AMUX_API_KEY = 'env-key';
    expect(
      resolveApiKey({ apiKey: 'db-key', metadata: { apiKey: 'metadata-key' } }),
    ).toBe('db-key');
  });

  it('falls back to metadata override when the db value is null', () => {
    process.env.AMUX_API_KEY = 'env-key';
    expect(resolveApiKey({ apiKey: null, metadata: { apiKey: 'metadata-key' } })).toBe(
      'metadata-key',
    );
  });

  it('treats an empty string db value as unset and falls through to metadata', () => {
    process.env.AMUX_API_KEY = 'env-key';
    expect(resolveApiKey({ apiKey: '', metadata: { apiKey: 'metadata-key' } })).toBe(
      'metadata-key',
    );
  });

  it('treats an empty string metadata value as unset and falls through to env', () => {
    process.env.AMUX_API_KEY = 'env-key';
    expect(resolveApiKey({ apiKey: '', metadata: { apiKey: '' } })).toBe('env-key');
  });

  it('falls back to the AMUX_API_KEY env var when db and metadata are both unset', () => {
    process.env.AMUX_API_KEY = 'env-key';
    expect(resolveApiKey({ apiKey: null, metadata: undefined })).toBe('env-key');
    // A broken implementation that returns the raw null instead of the env
    // fallback would fail the assertion above (it would resolve to
    // `undefined`, not `'env-key'`).
  });

  it('returns undefined when nothing is configured anywhere', () => {
    expect(resolveApiKey({ apiKey: null, metadata: null })).toBeUndefined();
  });

  it('ignores non-string metadata.apiKey values', () => {
    process.env.AMUX_API_KEY = 'env-key';
    expect(resolveApiKey({ apiKey: null, metadata: { apiKey: 123 } })).toBe('env-key');
  });
});

describe('resolveBaseUrl', () => {
  it('prefers a non-empty model_configs value over metadata and env', () => {
    process.env.AMUX_BASE_URL = 'https://env.gateway.test';
    expect(
      resolveBaseUrl({
        baseUrl: 'https://db.example.test',
        metadata: { baseUrl: 'https://metadata.example.test' },
      }),
    ).toBe('https://db.example.test');
  });

  it('falls back to metadata override when the db value is null', () => {
    process.env.AMUX_BASE_URL = 'https://env.gateway.test';
    expect(
      resolveBaseUrl({ baseUrl: null, metadata: { baseUrl: 'https://metadata.example.test' } }),
    ).toBe('https://metadata.example.test');
  });

  it('treats an empty string db value as unset and falls through to env', () => {
    process.env.AMUX_BASE_URL = 'https://env.gateway.test';
    expect(resolveBaseUrl({ baseUrl: '', metadata: undefined })).toBe(
      'https://env.gateway.test',
    );
  });

  it('returns undefined when nothing is configured anywhere', () => {
    expect(resolveBaseUrl({ baseUrl: undefined, metadata: undefined })).toBeUndefined();
  });
});

describe('resolveModelCredentials', () => {
  it('resolves both fields together via the env gateway fallback', () => {
    process.env.AMUX_API_KEY = 'env-key';
    process.env.AMUX_BASE_URL = 'https://env.gateway.test';
    expect(resolveModelCredentials({ apiKey: null, baseUrl: null, metadata: null })).toEqual({
      apiKey: 'env-key',
      baseUrl: 'https://env.gateway.test',
    });
  });

  it('leaves both fields undefined when nothing is configured', () => {
    expect(resolveModelCredentials({ apiKey: null, baseUrl: null })).toEqual({
      apiKey: undefined,
      baseUrl: undefined,
    });
  });
});
