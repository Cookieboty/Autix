import { describe, expect, test } from 'bun:test';
import { resolveVideoCapabilityFromModelParam } from '../src/growth/generator-video-presenters';

describe('resolveVideoCapabilityFromModelParam', () => {
  test('defaults to a seedance capability with resolutions', () => {
    const cap = resolveVideoCapabilityFromModelParam(null);
    expect(cap.kind).toBe('seedance-2.0');
    expect(cap.displayName).toBe('Seedance 2.0');
    expect(cap.resolutions.length).toBeGreaterThan(0);
    expect(cap.resolutions).toContain(cap.defaultResolution);
    expect(cap.resolutions).toContain('4k');
  });

  test('a fast variant exposes the narrower resolution set', () => {
    const cap = resolveVideoCapabilityFromModelParam('seedance-2.0-fast');
    expect(cap.resolutions).not.toContain('4k');
  });
});
