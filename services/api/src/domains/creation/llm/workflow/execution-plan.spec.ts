import { computeExecutionPlan } from './execution-plan';

const steps = [
  { stepKey: 'brief', dependencies: [], isOptional: false },
  { stepKey: 'outline', dependencies: ['brief'], isOptional: false },
  { stepKey: 'draft', dependencies: ['outline'], isOptional: false },
  { stepKey: 'polish', dependencies: ['draft'], isOptional: true },
  { stepKey: 'publish', dependencies: ['polish'], isOptional: true },
];

describe('computeExecutionPlan', () => {
  it('returns the full workflow in topological order when no target is provided', () => {
    expect(computeExecutionPlan(steps)).toEqual([
      'brief',
      'outline',
      'draft',
      'polish',
      'publish',
    ]);
  });

  it('returns only a target step and its dependencies', () => {
    expect(computeExecutionPlan(steps, 'draft')).toEqual(['brief', 'outline', 'draft']);
  });

  it('falls back to the full workflow for an unknown target step', () => {
    expect(computeExecutionPlan(steps, 'missing')).toEqual([
      'brief',
      'outline',
      'draft',
      'polish',
      'publish',
    ]);
  });

  it('ignores dependencies that are not in the selected step set', () => {
    expect(
      computeExecutionPlan([
        { stepKey: 'a', dependencies: ['external'] },
        { stepKey: 'b', dependencies: ['a'] },
      ]),
    ).toEqual(['a', 'b']);
  });
});
