import type { MembershipLevel, MembershipPlan } from './membership-user.actions';

export function isRecommendedMembershipLevel(level: MembershipLevel): boolean {
  const features = level.features;
  return Boolean(
    features &&
      !Array.isArray(features) &&
      typeof features === 'object' &&
      (features as Record<string, unknown>).recommended === true,
  );
}

export function findRecommendedMembershipLevel(
  levels: MembershipLevel[],
  predicate: (level: MembershipLevel) => boolean = () => true,
): MembershipLevel | null {
  const sortedLevels = [...levels].sort((a, b) => (a.sort ?? a.level) - (b.sort ?? b.level));
  return (
    sortedLevels.find((level) => predicate(level) && isRecommendedMembershipLevel(level)) ??
    sortedLevels.find((level) => predicate(level) && level.level > 0) ??
    sortedLevels.find(predicate) ??
    null
  );
}

export function findRecommendedMembershipPlan(
  levels: MembershipLevel[],
  predicate: (plan: MembershipPlan) => boolean,
): { level: MembershipLevel; plan: MembershipPlan } | null {
  const recommendedLevel = findRecommendedMembershipLevel(levels, (level) =>
    level.plans.some(predicate),
  );
  const recommendedPlan = recommendedLevel?.plans.find(predicate);
  if (recommendedLevel && recommendedPlan) {
    return { level: recommendedLevel, plan: recommendedPlan };
  }

  const sortedLevels = [...levels].sort((a, b) => (a.sort ?? a.level) - (b.sort ?? b.level));
  for (const level of sortedLevels) {
    const plan = level.plans.find(predicate);
    if (plan) return { level, plan };
  }

  return null;
}
