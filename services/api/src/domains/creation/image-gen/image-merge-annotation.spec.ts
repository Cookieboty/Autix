import { BadRequestException } from '@nestjs/common';
import sharp = require('sharp');
import {
  imageDataUrlToBuffer,
  isPrivateIpAddress,
  mergeAnnotationDataUrls,
  optionalUrlHostname,
} from './image-merge-annotation';

const transparentPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const redPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lJX8KwAAAABJRU5ErkJggg==';

describe('image merge annotation helpers', () => {
  it('normalizes optional URL hostnames', () => {
    expect(optionalUrlHostname('https://Example.COM/path')).toBe('example.com');
    expect(optionalUrlHostname('not a url')).toBeUndefined();
    expect(optionalUrlHostname(undefined)).toBeUndefined();
  });

  it('detects private IP ranges used by merge URL safety checks', () => {
    expect(isPrivateIpAddress('127.0.0.1')).toBe(true);
    expect(isPrivateIpAddress('10.0.1.2')).toBe(true);
    expect(isPrivateIpAddress('172.20.1.2')).toBe(true);
    expect(isPrivateIpAddress('192.168.1.2')).toBe(true);
    expect(isPrivateIpAddress('8.8.8.8')).toBe(false);
  });

  it('reads supported image data URLs and rejects unsupported image types', () => {
    expect(imageDataUrlToBuffer(transparentPng).byteLength).toBeGreaterThan(0);
    expect(() => imageDataUrlToBuffer('data:image/gif;base64,R0lGODlhAQABAAAAACw=')).toThrow(
      BadRequestException,
    );
  });

  it('merges image and overlay data URLs into a PNG data URL', async () => {
    const merged = await mergeAnnotationDataUrls(transparentPng, redPng);
    expect(merged.startsWith('data:image/png;base64,')).toBe(true);

    const metadata = await sharp(Buffer.from(merged.split(',')[1], 'base64')).metadata();
    expect(metadata.width).toBe(1);
    expect(metadata.height).toBe(1);
  });
});
