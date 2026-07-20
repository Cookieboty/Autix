'use client';

import type { ReactNode } from 'react';
import { Link } from '../navigation';

/**
 * 导航悬浮下拉里的一行（Image / Video 共用）。
 * 左侧图标块、标题、可选描述与徽章；hover 时标题转品牌色，图标由调用方
 * 通过 group-hover 自行控制（模型行用它恢复厂商彩色）。
 */
export function NavFlyoutRow({
  href,
  icon,
  title,
  desc,
  badge,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  desc?: string;
  badge?: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.04]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/5 text-foreground/70">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-growth-accent">
            {title}
          </span>
          {badge}
        </span>
        {desc ? (
          <span className="mt-0.5 block truncate text-xs text-foreground/45">{desc}</span>
        ) : null}
      </span>
    </Link>
  );
}
