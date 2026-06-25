import { describe, it, expect } from 'vitest';
import { assertAligned } from '../../check-i18n-consistency';

describe('assertAligned', () => {
  it('passes when all langs share identical leaf keys', () => {
    expect(assertAligned({ a: { x: '1' }, b: { x: '2' } })).toEqual([]);
  });
  it('reports a lang missing a key', () => {
    const issues = assertAligned({ a: { x: '1', y: '1' }, b: { x: '2' } });
    expect(issues.join(' ')).toContain('y');
  });
});
