import {
  isAmuxModelImportEnabled,
  isModelConfigEnabled,
  readBooleanEnv,
} from './env-flags';

describe('env feature flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ENABLE_MODEL_CONFIG;
    delete process.env.MODEL_CONFIG_ENABLED;
    delete process.env.ENABLE_AMUX_MODEL_IMPORT;
    delete process.env.AMUX_MODEL_IMPORT_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults model configuration and Amux model import to enabled', () => {
    expect(isModelConfigEnabled()).toBe(true);
    expect(isAmuxModelImportEnabled()).toBe(true);
  });

  it('accepts explicit false and true values', () => {
    process.env.ENABLE_MODEL_CONFIG = 'false';
    process.env.ENABLE_AMUX_MODEL_IMPORT = 'off';

    expect(isModelConfigEnabled()).toBe(false);
    expect(isAmuxModelImportEnabled()).toBe(false);

    process.env.ENABLE_MODEL_CONFIG = 'yes';
    process.env.ENABLE_AMUX_MODEL_IMPORT = '1';

    expect(isModelConfigEnabled()).toBe(true);
    expect(isAmuxModelImportEnabled()).toBe(true);
  });

  it('uses the first configured key with a valid non-empty value', () => {
    process.env.MODEL_CONFIG_ENABLED = 'disabled';
    expect(readBooleanEnv(['ENABLE_MODEL_CONFIG', 'MODEL_CONFIG_ENABLED'], true)).toBe(false);

    process.env.ENABLE_MODEL_CONFIG = 'enabled';
    expect(readBooleanEnv(['ENABLE_MODEL_CONFIG', 'MODEL_CONFIG_ENABLED'], false)).toBe(true);
  });
});
