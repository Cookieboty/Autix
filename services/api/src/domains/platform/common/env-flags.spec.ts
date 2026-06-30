import {
  isModelConfigEnabled,
  readBooleanEnv,
} from './env-flags';

describe('env feature flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ENABLE_MODEL_CONFIG;
    delete process.env.MODEL_CONFIG_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults model configuration to enabled', () => {
    expect(isModelConfigEnabled()).toBe(true);
  });

  it('accepts explicit false and true values', () => {
    process.env.ENABLE_MODEL_CONFIG = 'false';

    expect(isModelConfigEnabled()).toBe(false);

    process.env.ENABLE_MODEL_CONFIG = 'yes';

    expect(isModelConfigEnabled()).toBe(true);
  });

  it('uses the first configured key with a valid non-empty value', () => {
    process.env.MODEL_CONFIG_ENABLED = 'disabled';
    expect(readBooleanEnv(['ENABLE_MODEL_CONFIG', 'MODEL_CONFIG_ENABLED'], true)).toBe(false);

    process.env.ENABLE_MODEL_CONFIG = 'enabled';
    expect(readBooleanEnv(['ENABLE_MODEL_CONFIG', 'MODEL_CONFIG_ENABLED'], false)).toBe(true);
  });
});
