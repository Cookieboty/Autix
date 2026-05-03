'use client';

import type { AnyResource, ResourceType } from '@autix/shared-lib';
import { ResourceCard } from './ResourceCard';

export function ResourceGrid({
  items,
  resourceType,
  onClickItem,
  emptyText = '暂无资源',
  columns = 4,
}: {
  items: AnyResource[];
  resourceType?: ResourceType;
  onClickItem?: (item: AnyResource) => void;
  emptyText?: string;
  columns?: 3 | 4 | 5 | 6;
}) {
  if (items.length === 0) {
    return (
      <div
        className="text-center py-12 text-sm"
        style={{ color: 'var(--muted)' }}
      >
        {emptyText}
      </div>
    );
  }
  const gridClass =
    columns === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : columns === 5
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
        : columns === 6
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  return (
    <div className={`grid ${gridClass} gap-4`}>
      {items.map((item) => (
        <ResourceCard
          key={item.id}
          resource={item}
          resourceType={resourceType}
          onClick={onClickItem ? () => onClickItem(item) : undefined}
        />
      ))}
    </div>
  );
}
