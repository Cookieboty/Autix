import { isModelVisibleToUser, resolveRequestLocale } from './tasks.helpers';

describe('isModelVisibleToUser', () => {
  it('is visible when visibility is not public', () => {
    expect(isModelVisibleToUser({ visibility: 'private', allowedMembershipLevels: [] }, null)).toBe(true);
  });

  it('is visible when a public model has no membership restriction', () => {
    expect(isModelVisibleToUser({ visibility: 'public', allowedMembershipLevels: [] }, null)).toBe(true);
  });

  it('is invisible when restricted and the user has no matching level', () => {
    expect(
      isModelVisibleToUser(
        { visibility: 'public', allowedMembershipLevels: [{ levelId: 'lvl-pro' }] },
        null,
      ),
    ).toBe(false);
    expect(
      isModelVisibleToUser(
        { visibility: 'public', allowedMembershipLevels: [{ levelId: 'lvl-pro' }] },
        'lvl-basic',
      ),
    ).toBe(false);
  });

  it('is visible when the user level is in the allowed set', () => {
    expect(
      isModelVisibleToUser(
        { visibility: 'public', allowedMembershipLevels: [{ levelId: 'lvl-pro' }] },
        'lvl-pro',
      ),
    ).toBe(true);
  });
});

describe('resolveRequestLocale', () => {
  it('picks the first supported tag', () => {
    expect(resolveRequestLocale('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh-CN');
  });

  it('falls back to en when nothing supported matches', () => {
    expect(resolveRequestLocale('de-DE,de;q=0.9')).toBe('en');
  });

  it('falls back to en when the header is absent', () => {
    expect(resolveRequestLocale(undefined)).toBe('en');
  });
});
