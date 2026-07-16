import { describe, it, expect } from 'vitest';
import { visibilityFromAutoPublish } from './visibility-default';

describe('visibilityFromAutoPublish', () => {
  it('maps autoPublish=true to public', () => {
    expect(visibilityFromAutoPublish(true)).toBe('public');
  });

  it('maps autoPublish=false to private (fail-closed default)', () => {
    expect(visibilityFromAutoPublish(false)).toBe('private');
  });
});
