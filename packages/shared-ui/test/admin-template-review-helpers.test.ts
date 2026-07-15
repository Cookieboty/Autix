import type { AdminTemplateItem } from '@autix/shared-store';
import {
  defaultCapabilities,
  filterButtonClass,
  getTemplateMediaList,
  statusStyle,
} from '../src/admin/templates/template-review-helpers';

function template(overrides: Partial<AdminTemplateItem> = {}): AdminTemplateItem {
  return {
    id: 'tpl-1',
    title: 'Template',
    prompt: 'Prompt',
    category: 'portrait',
    status: 'PENDING',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isHot: false,
    ...overrides,
  } as AdminTemplateItem;
}

describe('admin template review helpers', () => {
  test('keeps capabilities opt-in by default', () => {
    expect(defaultCapabilities).toEqual({
      resourceSwitcher: false,
      batchActions: false,
      hot: false,
    });
  });

  test('reads media lists by resource type without changing field names', () => {
    expect(
      getTemplateMediaList(
        template({ exampleImages: ['image-a.png', 'image-b.png'] } as Partial<AdminTemplateItem>),
        'image-templates',
      ),
    ).toEqual(['image-a.png', 'image-b.png']);

    expect(
      getTemplateMediaList(
        template({ exampleMedia: ['video-a.mp4'] } as Partial<AdminTemplateItem>),
        'video-templates',
      ),
    ).toEqual(['video-a.mp4']);
  });

  test('keeps style helpers stable', () => {
    expect(statusStyle.PENDING.color).toBe('var(--warning)');
    expect(filterButtonClass(true)).toContain('bg-primary');
    expect(filterButtonClass(false)).toContain('bg-card');
  });
});
