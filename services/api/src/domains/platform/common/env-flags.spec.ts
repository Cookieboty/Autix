import {
  readBooleanEnv,
} from './env-flags';

describe('env feature flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TEST_FLAG_A;
    delete process.env.TEST_FLAG_B;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses the first configured key with a valid non-empty value', () => {
    process.env.TEST_FLAG_B = 'disabled';
    expect(readBooleanEnv(['TEST_FLAG_A', 'TEST_FLAG_B'], true)).toBe(false);

    process.env.TEST_FLAG_A = 'enabled';
    expect(readBooleanEnv(['TEST_FLAG_A', 'TEST_FLAG_B'], false)).toBe(true);
  });
});
