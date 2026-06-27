import { describe, expect, test } from 'bun:test';
import {
  resolveImageCapabilityFromModelParam,
  getImageCountControl,
} from '../src/growth/generator-image-presenters';

describe('resolveImageCapabilityFromModelParam', () => {
  test('defaults to gemini-3-pro-image when no model param', () => {
    expect(resolveImageCapabilityFromModelParam(null).kind).toBe('gemini-3-pro-image');
  });

  test('unknown marketing slug keeps the page default (not compatible)', () => {
    expect(resolveImageCapabilityFromModelParam('nano-banana-pro').kind).toBe(
      'gemini-3-pro-image',
    );
  });

  test('recognized gpt-image maps through', () => {
    expect(resolveImageCapabilityFromModelParam('gpt-image-1').kind).toBe('gpt-image');
  });

  test('explicit flux/sdxl maps to compatible', () => {
    expect(resolveImageCapabilityFromModelParam('my-flux-model').kind).toBe('compatible');
  });
});

describe('getImageCountControl', () => {
  test('hidden for maxCount 1', () => {
    expect(getImageCountControl({ maxCount: 1, defaults: { count: 1 } } as never)).toEqual({
      visible: false,
      max: 1,
      default: 1,
    });
  });

  test('visible for maxCount 4', () => {
    expect(getImageCountControl({ maxCount: 4, defaults: { count: 1 } } as never)).toEqual({
      visible: true,
      max: 4,
      default: 1,
    });
  });
});
