'use client';

import clsx from 'clsx';
import { ImageIcon, Loader2, TypeIcon, VideoIcon, AlertTriangle } from 'lucide-react';
import type { CanvasNode } from '@autix/domain';

const CARD = 'flex h-full w-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-neutral-800';

export function CanvasNodeCard({ node }: { node: CanvasNode }) {
  switch (node.kind) {
    case 'image':
    case 'material':
      return (
        <div className={CARD}>
          {node.resolvedUrl ? (
            <img src={node.resolvedUrl} alt={node.title ?? ''} className="h-full w-full object-cover" />
          ) : (
            <Placeholder icon={<ImageIcon size={20} />} label="图片" />
          )}
        </div>
      );
    case 'video':
      return (
        <div className={CARD}>
          {node.resolvedUrl ? (
            <video src={node.resolvedUrl} className="h-full w-full object-cover" controls />
          ) : (
            <Placeholder icon={<VideoIcon size={20} />} label="视频" />
          )}
        </div>
      );
    case 'prompt':
      return (
        <div className={clsx(CARD, 'p-3')}>
          <div className="mb-1 flex items-center gap-1 text-xs text-neutral-500">
            <TypeIcon size={14} /> Prompt
          </div>
          <p className="line-clamp-6 text-sm text-neutral-800 dark:text-neutral-100">{node.prompt}</p>
        </div>
      );
    case 'text':
    case 'note':
      return (
        <div className={clsx(CARD, 'p-3')}>
          <p className="text-sm text-neutral-800 dark:text-neutral-100">{node.text}</p>
        </div>
      );
    case 'generationTask':
      return (
        <div className={clsx(CARD, 'items-center justify-center gap-2 p-3')}>
          {node.taskStatus === 'failed' ? (
            <>
              <AlertTriangle size={22} className="text-red-500" />
              <span className="text-xs text-red-500">{node.error ?? '生成失败'}</span>
            </>
          ) : (
            <>
              <Loader2 size={22} className="animate-spin text-indigo-500" />
              <span className="text-xs text-neutral-500">生成中…</span>
            </>
          )}
        </div>
      );
    default:
      return <div className={clsx(CARD, 'items-center justify-center')}>{node.title ?? node.kind}</div>;
  }
}

function Placeholder({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-400">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
  );
}
