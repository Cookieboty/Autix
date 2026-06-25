import { generateInviteCode } from './invite.helpers';

describe('generateInviteCode', () => {
  it('produces a 16-char uppercase hex code (64 bits of entropy)', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[0-9A-F]{16}$/);
  });

  it('produces distinct codes across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    expect(codes.size).toBe(50);
  });
});
