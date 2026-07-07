'use client';

import { Skeleton } from '../../ui';

// 与真实模板墙 masonry（TEMPLATE_DENSITY_WALL_CLASS.relaxed）保持一致的列布局，
// 避免 loading → 内容 时从等高 grid 跳成瀑布流。
// 固定高度序列模拟不同宽高比的封面，用定值而非随机以保证 SSR/CSR 渲染一致。
const GALLERY_SKELETON_HEIGHTS = [
  'h-72',
  'h-96',
  'h-60',
  'h-80',
  'h-64',
  'h-72',
  'h-96',
  'h-60',
  'h-80',
  'h-72',
  'h-64',
  'h-96',
];

export function HomeGallerySkeleton({ count = 16 }: { count?: number }) {
  return (
    <div className="columns-1 gap-3 opacity-95 sm:columns-2 lg:columns-3 2xl:columns-4" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          className={`mb-2 w-full break-inside-avoid bg-secondary ${GALLERY_SKELETON_HEIGHTS[index % GALLERY_SKELETON_HEIGHTS.length]}`}
          style={{ animationDelay: `${(index % 6) * 90}ms` }}
        />
      ))}
    </div>
  );
}
