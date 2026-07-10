import { SUPPORTED_LOCALES, type Locale } from '@autix/domain/model';

/**
 * Duplicated (deliberately, in a small way) from
 * `model-config.service.ts#canUseSystemModel`: the input shapes differ (this one
 * takes the repository's raw row, not `ModelConfigService`'s response model) and
 * the two files live in different domains (`billing/points` vs
 * `creation/model-config`) — extracting a shared 4-line function across a domain
 * boundary for this would cost more than it saves. Extract to `packages/domain` if
 * a third call site ever needs the same logic.
 */
export function isModelVisibleToUser(
  model: { visibility: string; allowedMembershipLevels: Array<{ levelId: string }> },
  userLevelId: string | null,
): boolean {
  if (model.visibility !== 'public') return true;
  const allowedLevelIds = model.allowedMembershipLevels.map((item) => item.levelId);
  if (allowedLevelIds.length === 0) return true;
  return Boolean(userLevelId && allowedLevelIds.includes(userLevelId));
}

function isSupportedLocale(tag: string): tag is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(tag);
}

/** 解析 Accept-Language，取第一个受支持的 tag；都不支持则回退 en。 */
export function resolveRequestLocale(acceptLanguage: string | undefined): Locale {
  if (!acceptLanguage) return 'en';
  const tags = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter((tag): tag is string => Boolean(tag));

  for (const tag of tags) {
    if (isSupportedLocale(tag)) return tag;
  }
  return 'en';
}
