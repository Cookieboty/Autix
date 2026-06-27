import { TokenCipher } from './token-cipher';

describe('TokenCipher', () => {
  const key = '0'.repeat(64); // 32 字节 hex
  it('加密后能解回原文，且密文不等于明文', () => {
    const c = new TokenCipher(key);
    const enc = c.encrypt('secret-token');
    expect(enc).not.toBe('secret-token');
    expect(c.decrypt(enc)).toBe('secret-token');
  });
});
