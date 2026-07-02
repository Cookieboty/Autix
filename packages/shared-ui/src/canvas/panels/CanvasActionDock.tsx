'use client';

import { Loader2 } from 'lucide-react';
import type { CanvasAction } from '@autix/domain';

export function CanvasActionDock({ actions }: { actions: CanvasAction[] }) {
  const running = actions.filter((a) => a.status === 'running' || a.status === 'pending');
  if (running.length === 0) return null;
  return (
    <div className="flex items-center gap-3 border-t bg-white/80 px-4 py-2 text-sm backdrop-blur dark:bg-neutral-900/80">
      <Loader2 size={16} className="animate-spin text-indigo-500" />
      <span className="text-neutral-600 dark:text-neutral-300">
        {running.length} 个生成任务进行中
      </span>
    </div>
  );
}
