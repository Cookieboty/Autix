'use client';

import { Folder } from 'lucide-react';

/** 侧栏文件夹图标的蓝色。与导航 Assets 按钮那只（绿）刻意不同色。 */
export const FOLDER_GLYPH_COLOR = '#5FDDE5';

/**
 * 文件夹图形：设了 emoji 就渲染 emoji，否则回退默认的蓝色实心文件夹。
 * 标题与侧栏共用 —— 改了图标两处要同时变，各写一份必然漂移。
 */
export function FolderGlyph({
  icon,
  className = 'size-3.5',
}: {
  icon?: string | null;
  className?: string;
}) {
  if (icon) {
    // emoji 是文本，用 leading-none + 居中，免得撑高所在行。
    return (
      <span className={`grid shrink-0 place-items-center leading-none ${className}`} aria-hidden>
        <span className="text-[13px]">{icon}</span>
      </span>
    );
  }
  return (
    <Folder
      className={`shrink-0 ${className}`}
      style={{ color: FOLDER_GLYPH_COLOR, fill: FOLDER_GLYPH_COLOR }}
    />
  );
}
