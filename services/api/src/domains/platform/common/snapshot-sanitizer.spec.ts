import { sanitizeSnapshot, truncateToBytes, SNAPSHOT_BYTE_LIMIT } from './snapshot-sanitizer';

describe('sanitizeSnapshot', () => {
  it('把 data: URL 换成摘要，不保留 base64 内容', () => {
    const png = 'data:image/png;base64,' + 'A'.repeat(2000);
    const out = sanitizeSnapshot({ image: png }) as { image: Record<string, unknown> };
    expect(out.image.type).toBe('image/png');
    expect(out.image.bytes).toBe(2000);
    expect(typeof out.image.sha256).toBe('string');
    expect(JSON.stringify(out)).not.toContain('AAAA');
  });

  it('抹掉 callback_url 与凭据字段', () => {
    const out = sanitizeSnapshot({
      callback_url: 'https://cb/x?token=secret',
      apiKey: 'sk-live-123',
      Authorization: 'Bearer abc',
      token: 't',
    }) as Record<string, string>;
    expect(out.callback_url).toBe('[REDACTED]');
    expect(out.apiKey).toBe('[REDACTED]');
    expect(out.Authorization).toBe('[REDACTED]');
    expect(out.token).toBe('[REDACTED]');
  });

  it('去掉素材 URL 的签名参数，保留 host+path 便于排障', () => {
    const out = sanitizeSnapshot({
      url: 'https://cdn.example.com/a/b.png?X-Amz-Signature=deadbeef&expires=1',
    }) as Record<string, string>;
    expect(out.url).toBe('https://cdn.example.com/a/b.png');
  });

  it('递归处理数组与嵌套对象', () => {
    const out = sanitizeSnapshot({
      content: [{ image_url: { url: 'https://c/x.png?sig=1' } }, { apiKey: 'k' }],
    }) as { content: Array<Record<string, any>> };
    expect(out.content[0].image_url.url).toBe('https://c/x.png');
    expect(out.content[1].apiKey).toBe('[REDACTED]');
  });

  it('超过体积上限时截断并标注原始长度', () => {
    const out = sanitizeSnapshot({ note: 'x'.repeat(SNAPSHOT_BYTE_LIMIT * 2) }) as Record<
      string,
      unknown
    >;
    const serialized = JSON.stringify(out);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThanOrEqual(SNAPSHOT_BYTE_LIMIT + 200);
    // 用命名空间键而非裸 `truncated`，避免与业务快照里恰好同名的字段混淆。
    expect(out.__snapshotTruncated).toBe(true);
    expect(serialized).toContain('__snapshotTruncated');
  });

  it('降级路径的返回值二次序列化后仍不超过体积上限（即使原始内容全是引号）', () => {
    const out = sanitizeSnapshot({ note: '"'.repeat(SNAPSHOT_BYTE_LIMIT * 2) });
    const serialized = JSON.stringify(out);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThanOrEqual(SNAPSHOT_BYTE_LIMIT);
  });

  it('遇到循环引用不爆栈，用占位符替换', () => {
    const c: Record<string, unknown> = { a: 1 };
    c.self = c;
    let out: any;
    expect(() => {
      out = sanitizeSnapshot(c);
    }).not.toThrow();
    expect(out.a).toBe(1);
    expect(out.self).toBe('[Circular]');
  });

  it('__proto__ 键作为普通数据键被保留并净化，不篡改原型', () => {
    const input = JSON.parse('{"__proto__":{"apiKey":"LEAKED"},"safe":"ok"}');
    const out = sanitizeSnapshot(input) as Record<string, any>;
    expect(Object.keys(out)).toContain('safe');
    expect(Object.keys(out)).toContain('__proto__');
    expect(out.safe).toBe('ok');
    expect(out.__proto__.apiKey).toBe('[REDACTED]');
    expect(Object.getPrototypeOf(out)).not.toEqual({ apiKey: '[REDACTED]' });
  });

  it('Date 转成 ISO 字符串，不被静默清空', () => {
    const d = new Date('2024-01-01T00:00:00.000Z');
    const out = sanitizeSnapshot({ createdAt: d }) as Record<string, unknown>;
    expect(out.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('Map/Set 转成可读形态，不被静默清空', () => {
    const out = sanitizeSnapshot({
      m: new Map<string, number>([['a', 1]]),
      s: new Set([1, 2]),
    }) as Record<string, unknown>;
    expect(out.m).not.toEqual({});
    expect(out.s).not.toEqual({});
    expect(JSON.stringify(out)).toContain('1');
  });

  it('函数值被降级成占位字符串，不会把非 JSON 安全值透传给 Prisma', () => {
    const out = sanitizeSnapshot({ cb: function namedFn() {} }) as Record<string, unknown>;
    expect(out.cb).toBe('[Function]');
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it('Symbol 值被转成字符串，不被 JSON.stringify 静默丢弃', () => {
    const out = sanitizeSnapshot({ tag: Symbol('marker') }) as Record<string, unknown>;
    expect(out.tag).toBe('Symbol(marker)');
    expect(typeof out.tag).toBe('string');
  });

  it('BigInt 值被转成十进制字符串，不触发 JSON.stringify 抛错', () => {
    const out = sanitizeSnapshot({ big: 9007199254740993n }) as Record<string, unknown>;
    expect(out.big).toBe('9007199254740993');
    expect(() => JSON.stringify(out)).not.toThrow();
  });
});

describe('truncateToBytes', () => {
  it('按 UTF-8 字节而非字符数截断，不产生半个字符', () => {
    const out = truncateToBytes('中'.repeat(10), 7); // 每个中文 3 字节
    expect(Buffer.byteLength(out.split('…')[0], 'utf8')).toBeLessThanOrEqual(7);
    expect(out).toContain('truncated');
  });

  it('未超限时原样返回', () => {
    expect(truncateToBytes('abc', 100)).toBe('abc');
  });
});
