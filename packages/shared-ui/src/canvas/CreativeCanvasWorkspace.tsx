'use client';

import clsx from 'clsx';
import { Redo2, Undo2 } from 'lucide-react';
import { TldrawCanvasEngine } from './engine/TldrawCanvasEngine';
import { CanvasNodeCard } from './nodes/CanvasNodeCard';
import { CanvasSelectionActions } from './toolbar/CanvasSelectionActions';
import { CanvasActionDock } from './panels/CanvasActionDock';
import { saveIndicatorText, type SaveIndicator } from './canvas-view-model';
import {
  useCreativeCanvasController,
  type CreativeCanvasControllerOptions,
} from './useCreativeCanvasController';

export type CreativeCanvasWorkspaceProps = CreativeCanvasControllerOptions & {
  title?: string;
  readOnly?: boolean;
};

function toIndicator(saveStatus: string, dirty: boolean): SaveIndicator {
  if (saveStatus === 'saving') return 'saving';
  if (saveStatus === 'error') return 'error';
  if (saveStatus === 'conflict') return 'conflict';
  return dirty ? 'unsaved' : 'saved';
}

export function CreativeCanvasWorkspace(props: CreativeCanvasWorkspaceProps) {
  const c = useCreativeCanvasController(props);
  const indicator = toIndicator(c.saveStatus, c.dirty);

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <h1 className="text-sm font-semibold">{props.title ?? '创作画布'}</h1>
        <span className="text-xs text-neutral-500">{saveIndicatorText(indicator)}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={c.undo} className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="撤销">
            <Undo2 size={16} />
          </button>
          <button type="button" onClick={c.redo} className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="重做">
            <Redo2 size={16} />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-3 border-b px-4 py-2">
        <CanvasSelectionActions availability={c.availability} estimate={c.estimate} onRun={c.runAction} />
        {c.errorMessage && <span className="text-xs text-red-500">{c.errorMessage}</span>}
      </div>

      <div className={clsx('relative flex-1', props.readOnly && 'pointer-events-auto')}>
        <TldrawCanvasEngine
          nodes={c.state.nodes}
          selectedNodeIds={c.selectedNodeIds}
          viewport={c.state.viewport}
          readOnly={props.readOnly}
          onSelectionChange={c.setSelection}
          onNodeMove={c.moveNode}
          renderNode={(node) => <CanvasNodeCard node={node} />}
        />
      </div>

      <CanvasActionDock actions={c.runningActions} />
    </div>
  );
}
