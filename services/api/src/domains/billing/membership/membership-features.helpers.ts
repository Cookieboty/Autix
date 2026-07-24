import { HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { POINTS_CARRYOVER_MAX_CYCLES } from './membership-cycle.helpers';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(): I18nHttpException {
  return new I18nHttpException(
    HttpStatus.BAD_REQUEST,
    'membership.carryover_invalid',
    {},
    { code: 'BAD_REQUEST' },
  );
}

export function validatePointsCarryover(features: unknown): void {
  if (!isPlainObject(features) || !('pointsCarryover' in features)) return;
  const raw = features.pointsCarryover;
  if (!isPlainObject(raw)) throw invalid();
  if (typeof raw.enabled !== 'boolean') throw invalid();
  if (raw.enabled !== true) return; // 关闭态允许零值/缺省

  const { maxCycles, maxPoints } = raw;
  if (
    typeof maxCycles !== 'number' ||
    !Number.isInteger(maxCycles) ||
    maxCycles < 1 ||
    maxCycles > POINTS_CARRYOVER_MAX_CYCLES
  ) {
    throw invalid();
  }
  if (typeof maxPoints !== 'number' || !Number.isInteger(maxPoints) || maxPoints <= 0) {
    throw invalid();
  }
}
