import { isMembershipActiveAt } from './membership.guard';

describe('isMembershipActiveAt (FIX-20 expiry alignment)', () => {
  const now = new Date('2026-06-25T00:00:00.000Z');

  it('treats a membership expiring exactly now as inactive (expiresAt <= now)', () => {
    expect(isMembershipActiveAt({ status: 'ACTIVE', expiresAt: now }, now)).toBe(false);
  });

  it('treats a future expiry as active', () => {
    const future = new Date(now.getTime() + 60_000);
    expect(isMembershipActiveAt({ status: 'ACTIVE', expiresAt: future }, now)).toBe(true);
  });

  it('treats non-active status or missing membership as inactive', () => {
    const future = new Date(now.getTime() + 60_000);
    expect(isMembershipActiveAt({ status: 'EXPIRED', expiresAt: future }, now)).toBe(false);
    expect(isMembershipActiveAt(null, now)).toBe(false);
  });
});
