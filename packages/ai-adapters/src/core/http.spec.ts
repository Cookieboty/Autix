import { describe, it, expect } from 'vitest';
import { buildEndpoint } from './http';

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
