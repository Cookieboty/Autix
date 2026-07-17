import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isPrivateIpAddress,
  assertSafeFetchUrl,
  safeFetch,
  setSafeFetchResolver,
} from './safe-fetch';

describe('isPrivateIpAddress', () => {
  it('flags private / reserved IPv4 ranges', () => {
    for (const ip of [
      '0.0.0.0',
      '10.1.2.3',
      '127.0.0.1',
      '100.64.0.1', // CGNAT
      '169.254.169.254', // 云元数据
      '172.16.5.5',
      '172.31.255.255',
      '192.168.1.1',
      '224.0.0.1', // 组播
    ]) {
      expect(isPrivateIpAddress(ip)).toBe(true);
    }
  });

  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1']) {
      expect(isPrivateIpAddress(ip)).toBe(false);
    }
  });

  it('flags loopback / ULA / link-local IPv6 and IPv4-mapped (dotted + hex)', () => {
    for (const ip of [
      '::1', '::', 'fc00::1', 'fd12::34', 'fe80::1',
      '::ffff:127.0.0.1', // 点分映射
      '::ffff:7f00:1',    // 十六进制映射 = 127.0.0.1（URL 归一化后形态）
      '::ffff:a00:1',     // = 10.0.0.1
      '::ffff:a9fe:a9fe', // = 169.254.169.254 云元数据
    ]) {
      expect(isPrivateIpAddress(ip)).toBe(true);
    }
  });

  it('does not false-flag public IPv6 that merely ends in ffff groups', () => {
    expect(isPrivateIpAddress('2001:db8::ffff:7f00:1')).toBe(false);
    expect(isPrivateIpAddress('::ffff:8.8.8.8')).toBe(false); // 映射的公网地址
  });
});

describe('assertSafeFetchUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertSafeFetchUrl('file:///etc/passwd')).rejects.toThrow();
    await expect(assertSafeFetchUrl('gopher://x')).rejects.toThrow();
  });

  it('rejects localhost and private IP literals', async () => {
    await expect(assertSafeFetchUrl('http://localhost/x')).rejects.toThrow();
    await expect(assertSafeFetchUrl('http://127.0.0.1/x')).rejects.toThrow();
    await expect(assertSafeFetchUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow();
    await expect(assertSafeFetchUrl('http://[::1]/x')).rejects.toThrow();
  });

  it('accepts a public IP literal without DNS lookup', async () => {
    await expect(assertSafeFetchUrl('https://1.1.1.1/x')).resolves.toBeUndefined();
  });
});

describe('safeFetch timeout', () => {
  afterEach(() => {
    setSafeFetchResolver(null);
    vi.unstubAllGlobals();
  });

  // 让 SSRF 校验放行：注入解析到公网 IP 的 stub，避免真实 DNS。
  const stubPublicDns = () =>
    setSafeFetchResolver(async () => [{ address: '93.184.216.34', family: 4 }]);

  it('aborts using the caller-supplied timeoutMs', async () => {
    stubPublicDns();
    // fetch 永不 resolve，只在 signal abort 时 reject —— 由此断言超时确实生效。
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new Error('aborted-by-signal')),
        );
      }),
    );

    await expect(
      safeFetch('https://example.com/x', {}, { timeoutMs: 20 }),
    ).rejects.toThrow('aborted-by-signal');
  });

  it('honours the caller AbortSignal instead of swallowing it', async () => {
    stubPublicDns();
    // 真实 fetch（undici）对已 abort 的 signal 会同步立即 reject，而不仅仅监听未来的
    // 'abort' 事件（AbortSignal 对"晚绑定"的监听器不会补放已发生过的事件）。本用例里
    // controller.abort() 是在 safeFetch() 调用后立刻同步执行的，而 safeFetch 内部在
    // 真正发起 fetch 前必须先 await 一次 SSRF DNS 校验 —— 这个 await 保证了等到 fetch
    // 真正被调用时，signal 早已处于 aborted 状态。所以 stub 必须同时覆盖这两种路径
    // （已 aborted 时同步 reject / 尚未 aborted 时监听后续事件），才能如实模拟真实 fetch，
    // 而不是恰好只覆盖“调用时机足够晚”的那一种。
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        if (init.signal?.aborted) {
          reject(new Error('aborted-by-signal'));
          return;
        }
        init.signal?.addEventListener('abort', () =>
          reject(new Error('aborted-by-signal')),
        );
      }),
    );

    const controller = new AbortController();
    const promise = safeFetch(
      'https://example.com/x',
      { signal: controller.signal },
      { timeoutMs: 60_000 },
    );
    controller.abort();

    // 若实现仍用 signal: controller.signal 硬覆盖调用方 signal，这里会挂到 60s 超时后才 reject。
    await expect(promise).rejects.toThrow('aborted-by-signal');
  });

  // 回归守卫：超时只约束「拿到响应头」，必须在 safeFetch 返回 Response 时**解除**。
  //
  // 为什么这条至关重要：调用方拿到 Response 后才在函数外读 body
  // （video-asset-persistence 用 `await res.arrayBuffer()` 下 mp4，core/http.ts 用 `res.blob()`）。
  // 若超时未解除，它会一路延续到 body 流 —— 一个 30s 才下完的大视频会被判超时，
  // 而上游其实早已成功出片、积分也已扣掉，generation 却被误标 failed。
  //
  // 这正是把手动 controller + `finally { clearTimeout }` 换成 AbortSignal.timeout
  // 会引入的回归（后者无法解除）。断言"响应头之后 signal 未被 abort"即锁死该语义。
  it('disarms the timeout once the response headers arrived', async () => {
    stubPublicDns();
    let seenSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      seenSignal = init.signal ?? undefined;
      return new Response('ok', { status: 200 });
    });

    const res = await safeFetch('https://example.com/x', {}, { timeoutMs: 30 });
    expect(res.status).toBe(200);

    // 等到远超 timeoutMs：若超时未被解除，它会在此期间 fire 并 abort 掉 signal，
    // 而真实场景里此刻调用方正在读 body。
    await new Promise((resolve) => setTimeout(resolve, 90));
    expect(seenSignal?.aborted).toBe(false);
  });

  it('defaults to 30s when no timeoutMs is given', async () => {
    stubPublicDns();
    let seenSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      seenSignal = init.signal ?? undefined;
      return new Response('ok', { status: 200 });
    });

    const res = await safeFetch('https://example.com/x');
    expect(res.status).toBe(200);
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(seenSignal?.aborted).toBe(false);
  });
});
