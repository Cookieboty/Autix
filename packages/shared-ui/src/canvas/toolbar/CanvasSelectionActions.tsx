'use client';

import clsx from 'clsx';
import type { CanvasActionAvailability, CanvasActionEstimate } from '@autix/domain';
import { actionLabel, estimateBadge, reasonText } from '../canvas-view-model';

export interface CanvasSelectionActionsProps {
  availability: CanvasActionAvailability[];
  estimate: CanvasActionEstimate | null;
  onRun: (actionType: CanvasActionAvailability['actionType']) => void;
}

/**
 * Selection-driven action buttons. Billable actions show a cost badge; when
 * unavailable they stay visible but disabled with the reason — never hidden.
 */
export function CanvasSelectionActions({ availability, estimate, onRun }: CanvasSelectionActionsProps) {
  if (availability.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {availability.map((action) => {
        const disabled = !action.available;
        const badge = action.available && action.billable ? estimateBadge(estimate) : '';
        return (
          <button
            key={action.actionType}
            type="button"
            disabled={disabled}
            title={action.reason ? reasonText(action.reason) : undefined}
            onClick={() => onRun(action.actionType)}
            className={clsx(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition',
              disabled
                ? 'cursor-not-allowed bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
                : 'bg-indigo-600 text-white hover:bg-indigo-500',
            )}
          >
            <span>{actionLabel(action.actionType)}</span>
            {badge && <span className="rounded bg-black/20 px-1.5 py-0.5 text-xs">{badge}</span>}
            {disabled && action.reason && (
              <span className="text-xs text-neutral-400">· {reasonText(action.reason)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
