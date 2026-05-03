'use client';

import type { ReactNode } from 'react';

export function CollapsibleSidebarFrame({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="h-full flex-shrink-0 transition-[width] duration-200"
      style={{ width: collapsed ? 72 : 244 }}
    >
      {children}
    </div>
  );
}
