import {
  resolveApiKey,
  resolveBaseUrl,
  resolveModelCredentials,
} from './model-gateway-credentials';

const ENV_KEYS = ['AMUX_API_KEY', 'AMUX_BASE_URL', 'POYO_API_KEY', 'POYO_BASE_URL', 'MY_GW_API_KEY'] as const;
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
  it('prefers a non-empty model_configs value over env', () => {
    process.env.AMUX_API_KEY = 'env-key';
    expect(resolveApiKey({ apiKey: 'db-key' })).toBe('db-key');
  });

  it('NEVER reads metadata.apiKey — metadata is not a credential channel', () => {
    // 安全底线（spec 口径 6）：metadata 会被下发到客户端，绝不能兼作凭据来源。
    // 只要这个字段还能被当作凭据读，它就还是一条泄漏路径 —— 所以是删除，不是脱敏。
    delete process.env.AMUX_API_KEY;
    expect(resolveApiKey({ apiKey: null, metadata: { apiKey: 'metadata-key' } })).toBeUndefined();
  });

  it('does not let metadata.apiKey shadow the system gateway env', () => {
    // 变异测试：旧实现的解析链是「列 → metadata → env」，metadata 会盖住 env。
    // 若有人把 metadata 那一环加回去，这条会红。
    process.env.AMUX_API_KEY = 'env-key';
    expect(resolveApiKey({ apiKey: null, metadata: { apiKey: 'metadata-key' } })).toBe('env-key');
  });

  it('treats an empty string db value as unset and falls through to env', () => {
    process.env.AMUX_API_KEY = 'env-key';
    expect(resolveApiKey({ apiKey: '   ' })).toBe('env-key');
  });

  it('falls back to the AMUX_API_KEY env var when the column is unset', () => {
    process.env.AMUX_API_KEY = 'env-key';
    expect(resolveApiKey({ apiKey: null, metadata: undefined })).toBe('env-key');
  });

  it('returns undefined when nothing is configured anywhere', () => {
    expect(resolveApiKey({ apiKey: null, metadata: null })).toBeUndefined();
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

describe('通用网关：凭据 env 名由 metadata.gateway 派生（代码不硬编码渠道名）', () => {
  it('metadata.gateway=poyo → 从 POYO_API_KEY 解析，不落到 AMUX', () => {
    process.env.AMUX_API_KEY = 'amux-key';
    process.env.POYO_API_KEY = 'gw-key';
    expect(resolveApiKey({ apiKey: null, metadata: { gateway: 'poyo' } })).toBe('gw-key');
  });

  it('gateway id 安全化：非字母数字转 _（my-gw → MY_GW_API_KEY）', () => {
    process.env.MY_GW_API_KEY = 'gw-key';
    expect(resolveApiKey({ apiKey: null, metadata: { gateway: 'my-gw' } })).toBe('gw-key');
  });

  it('网关模型 DB apiKey 仍优先于 env', () => {
    process.env.POYO_API_KEY = 'gw-key';
    expect(resolveApiKey({ apiKey: 'db-key', metadata: { gateway: 'poyo' } })).toBe('db-key');
  });

  it('baseUrl 由 <GATEWAY>_BASE_URL 派生（无硬编码默认地址）', () => {
    expect(resolveBaseUrl({ baseUrl: null, metadata: { gateway: 'poyo' } })).toBeUndefined();
    process.env.POYO_BASE_URL = 'https://gw.example.test';
    expect(resolveBaseUrl({ baseUrl: null, metadata: { gateway: 'poyo' } })).toBe('https://gw.example.test');
  });

  it('未设 gateway 的模型不受影响，仍走 AMUX', () => {
    process.env.AMUX_API_KEY = 'amux-key';
    process.env.POYO_API_KEY = 'gw-key';
    expect(resolveApiKey({ apiKey: null, metadata: null })).toBe('amux-key');
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
