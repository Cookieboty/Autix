import { describe, it, expect } from 'vitest';
import { buildEndpoint, readOpenAIImageResponse } from './http';

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

describe('readOpenAIImageResponse', () => {
  it('extracts b64_json as data URL', () => {
    const result = readOpenAIImageResponse({
      data: [{ b64_json: 'abc123' }],
    });
    expect(result).toEqual(['data:image/png;base64,abc123']);
  });

  it('extracts url directly', () => {
    const result = readOpenAIImageResponse({
      data: [{ url: 'https://img.test/1.png' }],
    });
    expect(result).toEqual(['https://img.test/1.png']);
  });

  it('handles mixed results', () => {
    const result = readOpenAIImageResponse({
      data: [
        { b64_json: 'abc' },
        { url: 'https://img.test/2.png' },
        {},
      ],
    });
    expect(result).toEqual([
      'data:image/png;base64,abc',
      'https://img.test/2.png',
    ]);
  });

  it('handles undefined data', () => {
    expect(readOpenAIImageResponse(undefined)).toEqual([]);
    expect(readOpenAIImageResponse({})).toEqual([]);
  });
});
