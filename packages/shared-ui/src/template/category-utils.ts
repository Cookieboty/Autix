export const TEMPLATE_CATEGORY_KEYS = [
  'portrait',
  'landscape',
  'product',
  'illustration',
  'architecture',
  'scifi',
  'scene',
] as const;

export type TemplateCategoryKey = (typeof TEMPLATE_CATEGORY_KEYS)[number];

export const LEGACY_TEMPLATE_CATEGORY_VALUES: Record<TemplateCategoryKey, string> = {
  portrait: '\u4eba\u50cf',
  landscape: '\u98ce\u666f',
  product: '\u4ea7\u54c1',
  illustration: '\u63d2\u753b',
  architecture: '\u5efa\u7b51',
  scifi: '\u79d1\u5e7b',
  scene: '\u573a\u666f',
};

export const TEMPLATE_CATEGORY_I18N_KEY: Record<string, TemplateCategoryKey> = Object.fromEntries(
  Object.entries(LEGACY_TEMPLATE_CATEGORY_VALUES).map(([key, value]) => [value, key]),
) as Record<string, TemplateCategoryKey>;

export function getTemplateCategoryI18nKey(category: string | null | undefined): TemplateCategoryKey {
  if (!category) return 'portrait';
  if (TEMPLATE_CATEGORY_KEYS.includes(category as TemplateCategoryKey)) {
    return category as TemplateCategoryKey;
  }
  return TEMPLATE_CATEGORY_I18N_KEY[category] ?? 'portrait';
}
