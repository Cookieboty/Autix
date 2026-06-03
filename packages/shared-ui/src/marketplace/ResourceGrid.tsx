'use client';

import type { AnyResource, ResourceType } from '@autix/shared-lib';
import { ResourceCard } from './ResourceCard';

export function ResourceGrid({
  items,
  resourceType,
  onClickItem,
  emptyText = '暂无资源',
  columns = 4,
  layout = 'grid',
}: {
  items: AnyResource[];
  resourceType?: ResourceType;
  onClickItem?: (item: AnyResource) => void;
  emptyText?: string;
  columns?: 3 | 4 | 5 | 6;
  layout?: 'grid' | 'masonry';
}) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
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
  const masonryClass =
    columns === 3
      ? 'columns-1 sm:columns-2 lg:columns-3'
      : columns === 5
        ? 'columns-1 sm:columns-2 lg:columns-4 xl:columns-5'
        : columns === 6
          ? 'columns-1 sm:columns-2 lg:columns-4 xl:columns-6'
          : 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4';

  if (layout === 'masonry') {
    return (
      <div className={`${masonryClass} gap-4 [column-fill:_balance]`}>
        {items.map((item, index) => (
          <div key={item.id} className="mb-4 break-inside-avoid">
            <ResourceCard
              resource={item}
              resourceType={resourceType}
              index={index}
              variant="masonry"
              onClick={onClickItem ? () => onClickItem(item) : undefined}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {items.map((item, index) => (
        <ResourceCard
          key={item.id}
          resource={item}
          resourceType={resourceType}
          index={index}
          onClick={onClickItem ? () => onClickItem(item) : undefined}
        />
      ))}
    </div>
  );
}
