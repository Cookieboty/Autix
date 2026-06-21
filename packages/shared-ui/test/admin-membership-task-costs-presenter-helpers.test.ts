import { describe, expect, test } from 'bun:test';
import { getStatusBadgePresentation } from '../src/admin/membership/task-costs-presenter-helpers';

describe('admin membership task cost presenter helpers', () => {
  test('builds status badge presentation for active rules', () => {
    expect(
      getStatusBadgePresentation({
        active: true,
        activeText: 'Active',
        inactiveText: 'Inactive',
      }),
    ).toEqual({
      label: 'Active',
      color: 'var(--success)',
      backgroundColor: 'var(--success-soft)',
    });
  });

  test('builds status badge presentation for inactive rules', () => {
    expect(
      getStatusBadgePresentation({
        active: false,
        activeText: 'Active',
        inactiveText: 'Inactive',
      }),
    ).toEqual({
      label: 'Inactive',
      color: 'var(--muted)',
      backgroundColor: 'var(--muted-soft)',
    });
  });

  test('missing status takes precedence over rule activity', () => {
    expect(
      getStatusBadgePresentation({
        active: true,
        missing: true,
        activeText: 'Active',
        inactiveText: 'Inactive',
        missingText: 'Missing',
      }),
    ).toEqual({
      label: 'Missing',
      color: 'var(--danger)',
      backgroundColor: 'var(--danger-soft)',
    });
  });
});
