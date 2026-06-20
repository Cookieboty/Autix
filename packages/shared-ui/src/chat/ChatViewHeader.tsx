'use client';

import { PanelLeftIcon } from 'lucide-react';

export function ChatViewHeader({
  onToggleSidebar,
}: {
  onToggleSidebar?: () => void;
}) {
  return (
    <header className="z-30 flex h-12 w-full min-w-0 shrink-0 items-center gap-2 border-b border-white/10 bg-black/12 px-3">
      {onToggleSidebar && (
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={onToggleSidebar}
        >
          <PanelLeftIcon className="size-4" />
          <span className="sr-only">Toggle Sidebar</span>
        </button>
      )}
    </header>
  );
}
