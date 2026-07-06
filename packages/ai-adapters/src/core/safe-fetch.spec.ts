import { describe, it, expect } from 'vitest';
import { isPrivateIpAddress, assertSafeFetchUrl } from './safe-fetch';

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
