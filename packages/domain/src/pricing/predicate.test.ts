import { describe, expect, it } from 'vitest';
import { matchesPredicate } from './predicate';

describe('matchesPredicate', () => {
  it('returns true when there is no predicate', () => {
    expect(matchesPredicate(undefined, {})).toBe(true);
  });

  it('conjoins every clause', () => {
    const when = {
      all: [
        { param: 'priority', op: 'eq' as const, value: true },
        { param: 'seconds', op: 'gt' as const, value: 5 },
      ],
    };
    expect(matchesPredicate(when, { priority: true, seconds: 10 })).toBe(true);
    expect(matchesPredicate(when, { priority: true, seconds: 5 })).toBe(false);
    expect(matchesPredicate(when, { priority: false, seconds: 10 })).toBe(false);
  });

  it('supports eq and ne', () => {
    expect(matchesPredicate({ all: [{ param: 'q', op: 'eq', value: 'high' }] }, { q: 'high' })).toBe(true);
    expect(matchesPredicate({ all: [{ param: 'q', op: 'ne', value: 'high' }] }, { q: 'low' })).toBe(true);
    expect(matchesPredicate({ all: [{ param: 'q', op: 'ne', value: 'high' }] }, { q: 'high' })).toBe(false);
  });

  it('supports in against an array value', () => {
    const when = { all: [{ param: 'resolution', op: 'in' as const, value: ['2K', '4K'] }] };
    expect(matchesPredicate(when, { resolution: '4K' })).toBe(true);
    expect(matchesPredicate(when, { resolution: '1K' })).toBe(false);
  });

  it('supports gt gte lt lte on numbers', () => {
    expect(matchesPredicate({ all: [{ param: 'n', op: 'gt', value: 5 }] }, { n: 6 })).toBe(true);
    expect(matchesPredicate({ all: [{ param: 'n', op: 'gte', value: 5 }] }, { n: 5 })).toBe(true);
    expect(matchesPredicate({ all: [{ param: 'n', op: 'lt', value: 5 }] }, { n: 4 })).toBe(true);
    expect(matchesPredicate({ all: [{ param: 'n', op: 'lte', value: 5 }] }, { n: 5 })).toBe(true);
    expect(matchesPredicate({ all: [{ param: 'n', op: 'gt', value: 5 }] }, { n: 5 })).toBe(false);
  });

  it('returns false for comparison ops when the param is absent or non-numeric', () => {
    expect(matchesPredicate({ all: [{ param: 'n', op: 'gt', value: 5 }] }, {})).toBe(false);
    expect(matchesPredicate({ all: [{ param: 'n', op: 'gt', value: 5 }] }, { n: 'six' })).toBe(false);
  });

  it('treats an absent param as not equal for eq, and as not-equal-satisfied for ne', () => {
    expect(matchesPredicate({ all: [{ param: 'q', op: 'eq', value: 'high' }] }, {})).toBe(false);
    expect(matchesPredicate({ all: [{ param: 'q', op: 'ne', value: 'high' }] }, {})).toBe(true);
  });

  it('returns false for in when the clause value is not an array', () => {
    expect(matchesPredicate({ all: [{ param: 'r', op: 'in', value: '4K' }] }, { r: '4K' })).toBe(false);
  });
});
