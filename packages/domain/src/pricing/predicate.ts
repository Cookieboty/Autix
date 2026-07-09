import type { Clause, Predicate } from './types';

function matchesClause(clause: Clause, params: Record<string, unknown>): boolean {
  const actual = params[clause.param];

  switch (clause.op) {
    case 'eq':
      return actual === clause.value;
    case 'ne':
      return actual !== clause.value;
    case 'in':
      return Array.isArray(clause.value) && clause.value.includes(actual);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (typeof actual !== 'number' || !Number.isFinite(actual)) return false;
      if (typeof clause.value !== 'number') return false;
      if (clause.op === 'gt') return actual > clause.value;
      if (clause.op === 'gte') return actual >= clause.value;
      if (clause.op === 'lt') return actual < clause.value;
      return actual <= clause.value;
    }
    default:
      return false;
  }
}

/** `when` 为 undefined 时视为无条件成立。仅支持合取。 */
export function matchesPredicate(
  when: Predicate | undefined,
  params: Record<string, unknown>,
): boolean {
  if (!when) return true;
  return when.all.every((clause) => matchesClause(clause, params));
}
