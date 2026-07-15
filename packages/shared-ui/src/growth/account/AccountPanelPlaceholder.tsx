'use client';

import type { ComponentType } from 'react';

/** 设置子页尚未接入真实功能时的统一占位骨架（标题 + 副标题 + 空态卡）。 */
export function AccountPanelPlaceholder({
  icon: Icon,
  title,
  subtitle,
  emptyLabel,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  emptyLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-black text-foreground">
          <Icon className="size-6 text-growth-accent" />
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-foreground/55">{subtitle}</p>
      </div>

      {children ?? (
        <div className="grid min-h-[220px] place-items-center rounded-2xl bg-[rgb(24,25,28)] p-8 text-center">
          <p className="text-sm text-foreground/45">{emptyLabel}</p>
        </div>
      )}
    </div>
  );
}
