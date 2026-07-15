import { describe, it, expect } from 'vitest';
import { buildEndpoint, fetchUrlAsBase64 } from './http';

describe('buildEndpoint', () => {
  it('appends endpoint to base', () => {
    expect(buildEndpoint('https://api.example.com', '/v1/images/generations'))
      .toBe('https://api.example.com/v1/images/generations');
  });

  it('deduplicates /v1 when both base and endpoint contain it', () => {
    expect(buildEndpoint('https://api.example.com/v1', '/v1/images/generations'))
      .toBe('https://api.example.com/v1/images/generations');
  });

  it('strips trailing slash from base', () => {
    expect(buildEndpoint('https://api.example.com/', '/v1/images/generations'))
      .toBe('https://api.example.com/v1/images/generations');
  });

  it('prepends / to endpoint if missing', () => {
    expect(buildEndpoint('https://api.example.com', 'v1/images/generations'))
      .toBe('https://api.example.com/v1/images/generations');
  });
});

describe('fetchUrlAsBase64', () => {
  it('returns the payload as base64 and the mime type from the response', async () => {
    // data: URL 由 safeFetch 直通、无网络/DNS，测试因此免打桩。AQIDBA== = bytes [1,2,3,4]。
    const out = await fetchUrlAsBase64('data:image/png;base64,AQIDBA==');
    expect(out).toEqual({ base64: 'AQIDBA==', mimeType: 'image/png' });
  });
});
