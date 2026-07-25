import { validatePointsCarryover } from './membership-features.helpers';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

describe('validatePointsCarryover', () => {
  it('passes when carryover absent or disabled with zero values', () => {
    expect(() => validatePointsCarryover({})).not.toThrow();
    expect(() =>
      validatePointsCarryover({ pointsCarryover: { enabled: false, maxCycles: 0, maxPoints: 0 } }),
    ).not.toThrow();
    expect(() => validatePointsCarryover('not-an-object')).not.toThrow();
  });

  it('rejects non-object / non-boolean enabled', () => {
    expect(() => validatePointsCarryover({ pointsCarryover: null })).toThrow(I18nHttpException);
    expect(() => validatePointsCarryover({ pointsCarryover: [] })).toThrow(I18nHttpException);
    expect(() => validatePointsCarryover({ pointsCarryover: { enabled: 'yes' } })).toThrow(
      I18nHttpException,
    );
  });

  it('rejects enabled config with out-of-range numbers', () => {
    expect(() =>
      validatePointsCarryover({ pointsCarryover: { enabled: true, maxCycles: 0, maxPoints: 100 } }),
    ).toThrow(I18nHttpException);
    expect(() =>
      validatePointsCarryover({ pointsCarryover: { enabled: true, maxCycles: 13, maxPoints: 100 } }),
    ).toThrow(I18nHttpException);
    expect(() =>
      validatePointsCarryover({ pointsCarryover: { enabled: true, maxCycles: 1.5, maxPoints: 100 } }),
    ).toThrow(I18nHttpException);
    expect(() =>
      validatePointsCarryover({ pointsCarryover: { enabled: true, maxCycles: 2, maxPoints: 0 } }),
    ).toThrow(I18nHttpException);
  });

  it('accepts valid enabled config', () => {
    expect(() =>
      validatePointsCarryover({ pointsCarryover: { enabled: true, maxCycles: 12, maxPoints: 20000 } }),
    ).not.toThrow();
  });
});
