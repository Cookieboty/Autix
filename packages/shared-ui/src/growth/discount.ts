export const DISCOUNT_PERCENT = 20;

export function getDiscountFraction() {
  return DISCOUNT_PERCENT / 100;
}

export function getDiscountedFactor() {
  return 1 - getDiscountFraction();
}

export function getChineseDiscountTenths() {
  return Math.round((10 * (100 - DISCOUNT_PERCENT)) / 100);
}

export function formatDiscountPercent() {
  return `${DISCOUNT_PERCENT}%`;
}

export function formatDiscountOffLabel() {
  return `-${DISCOUNT_PERCENT}%`;
}

export function formatChineseDiscountLabel() {
  return `${getChineseDiscountTenths()} 折`;
}

export function buildDiscountTranslationValues() {
  return {
    percent: DISCOUNT_PERCENT,
    zhe: getChineseDiscountTenths(),
  };
}
