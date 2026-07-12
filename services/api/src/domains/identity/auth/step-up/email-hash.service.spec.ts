import { EmailHashService } from './email-hash.service';

describe('EmailHashService', () => {
  const OLD_KEY = process.env.EMAIL_HASH_HMAC_KEY;
  const OLD_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.EMAIL_HASH_HMAC_KEY = 'test-fixed-key';
  });

  afterAll(() => {
    if (OLD_KEY === undefined) delete process.env.EMAIL_HASH_HMAC_KEY;
    else process.env.EMAIL_HASH_HMAC_KEY = OLD_KEY;
    if (OLD_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = OLD_NODE_ENV;
  });

  it('hash 输出稳定 64 hex 字符', () => {
    const svc = new EmailHashService();
    const h = svc.hash('user@example.com');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash 大小写/首尾空白视为同一 bucket', () => {
    const svc = new EmailHashService();
    const a = svc.hash('User@Example.com');
    const b = svc.hash('  user@example.com  ');
    const c = svc.hash('user@example.com');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('hash 不同邮箱输出不同', () => {
    const svc = new EmailHashService();
    expect(svc.hash('a@example.com')).not.toBe(svc.hash('b@example.com'));
  });

  it('不同 secret key 输出不同（防止 secret 未生效）', () => {
    process.env.EMAIL_HASH_HMAC_KEY = 'key-1';
    const s1 = new EmailHashService();
    process.env.EMAIL_HASH_HMAC_KEY = 'key-2';
    const s2 = new EmailHashService();
    expect(s1.hash('same@x.com')).not.toBe(s2.hash('same@x.com'));
  });

  it('缺少 EMAIL_HASH_HMAC_KEY 时使用 dev fallback（仍应可 hash）', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.EMAIL_HASH_HMAC_KEY;
    const svc = new EmailHashService();
    expect(svc.hash('a@x.com')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('production 缺少 EMAIL_HASH_HMAC_KEY 时启动失败', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.EMAIL_HASH_HMAC_KEY;
    expect(() => new EmailHashService()).toThrow('EMAIL_HASH_HMAC_KEY is required in production');
  });

  it('mask 保留首字符与域名', () => {
    expect(EmailHashService.mask('alice@example.com')).toBe('a****@example.com');
    expect(EmailHashService.mask('b@x.com')).toBe('b*@x.com');
  });

  it('mask 非法邮箱原样返回', () => {
    expect(EmailHashService.mask('not-an-email')).toBe('not-an-email');
  });
});
