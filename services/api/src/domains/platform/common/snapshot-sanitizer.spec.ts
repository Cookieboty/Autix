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
    const out = sanitizeSnapshot({ note: 'x'.repeat(SNAPSHOT_BYTE_LIMIT * 2) });
    const serialized = JSON.stringify(out);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThanOrEqual(SNAPSHOT_BYTE_LIMIT + 200);
    expect(serialized).toContain('truncated');
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
