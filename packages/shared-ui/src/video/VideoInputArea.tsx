'use client';

import { Plus, X, ArrowLeftRight, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VideoGenMode } from './VideoToolbar';

export interface VideoMaterial {
  id: string;
  url: string;
  name?: string;
  type: 'image' | 'video' | 'audio';
}

export interface FrameSlot {
  id: string;
  material: VideoMaterial | null;
  duration: number;
}

interface VideoInputAreaProps {
  mode: VideoGenMode;
  materials: VideoMaterial[];
  frames: FrameSlot[];
  onAddMaterial: (files: File[]) => void;
  onRemoveMaterial: (id: string) => void;
  onAddFrame: () => void;
  onRemoveFrame: (id: string) => void;
  onSwapFirstLastFrames: () => void;
  onFrameFileUpload: (frameId: string, files: File[]) => void;
  onClearAll: () => void;
}

export function VideoInputArea({
  mode,
  materials,
  frames,
  onAddMaterial,
  onRemoveMaterial,
  onAddFrame,
  onRemoveFrame,
  onSwapFirstLastFrames,
  onFrameFileUpload,
  onClearAll,
}: VideoInputAreaProps) {
  if (mode === 'reference') {
    return <ReferenceMode materials={materials} onAdd={onAddMaterial} onRemove={onRemoveMaterial} />;
  }

  if (mode === 'first_last_frame') {
    return (
      <FirstLastFrameMode
        firstFrame={frames[0] ?? null}
        lastFrame={frames[1] ?? null}
        onSwap={onSwapFirstLastFrames}
        onFileUpload={onFrameFileUpload}
      />
    );
  }

  return (
    <SmartMultiframeMode
      frames={frames}
      onAddFrame={onAddFrame}
      onRemoveFrame={onRemoveFrame}
      onFrameFileUpload={onFrameFileUpload}
      onClearAll={onClearAll}
    />
  );
}

function ReferenceMode({
  materials,
  onAdd,
  onRemove,
}: {
  materials: VideoMaterial[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('videoWorkbench.legacy.inputArea');
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onAdd(Array.from(files));
    }
    e.target.value = '';
  };

  if (materials.length === 0) {
    return (
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/16 bg-white/[0.035] px-3 py-2 text-xs text-white/54 transition-colors hover:border-white/45 hover:bg-white/[0.07] hover:text-white/78">
        <div className="flex size-10 items-center justify-center rounded-md border border-dashed border-white/16 bg-black/10">
          <Plus className="size-4" />
        </div>
        <span>{t('referenceContent')}</span>
        <input
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {materials.map((mat) => (
          <div key={mat.id} className="relative group">
            {mat.type === 'video' ? (
              <video src={mat.url} muted preload="metadata" className="size-12 rounded-md border border-white/14 object-cover" />
            ) : mat.type === 'image' ? (
              <img src={mat.url} alt="" className="size-12 rounded-md border border-white/14 object-cover" />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-md border border-white/14 bg-white/[0.055] text-[9px] text-white/58">
                {t('audio')}
              </div>
            )}
            <button
              type="button"
              className="absolute -right-1 -top-1 hidden group-hover:flex size-4 items-center justify-center rounded-full bg-destructive text-white"
              onClick={() => onRemove(mat.id)}
            >
              <X className="size-2.5" />
            </button>
          </div>
      ))}
      {materials.length < 12 && (
        <label className="flex size-12 cursor-pointer items-center justify-center rounded-md border border-dashed border-white/16 bg-white/[0.035] transition-colors hover:border-white/45 hover:bg-white/[0.07]">
          <Plus className="size-4 text-white/54" />
          <input
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  );
}

function FirstLastFrameMode({
  firstFrame,
  lastFrame,
  onSwap,
  onFileUpload,
}: {
  firstFrame: FrameSlot | null;
  lastFrame: FrameSlot | null;
  onSwap: () => void;
  onFileUpload: (frameId: string, files: File[]) => void;
}) {
  const t = useTranslations('videoWorkbench.legacy.inputArea');
  return (
    <div className="flex items-center gap-2">
      <FrameCard
        frame={firstFrame}
        frameId={firstFrame?.id ?? 'first'}
        label={t('firstFrame')}
        onFileUpload={onFileUpload}
      />
      <button
        type="button"
        aria-label={t('swapFrames')}
        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/48 transition-colors hover:border-white/22 hover:bg-white/[0.09] hover:text-white"
        onClick={onSwap}
      >
        <ArrowLeftRight className="size-4" />
      </button>
      <FrameCard
        frame={lastFrame}
        frameId={lastFrame?.id ?? 'last'}
        label={t('lastFrame')}
        onFileUpload={onFileUpload}
      />
    </div>
  );
}

function SmartMultiframeMode({
  frames,
  onAddFrame,
  onRemoveFrame,
  onFrameFileUpload,
  onClearAll,
}: {
  frames: FrameSlot[];
  onAddFrame: () => void;
  onRemoveFrame: (id: string) => void;
  onFrameFileUpload: (frameId: string, files: File[]) => void;
  onClearAll: () => void;
}) {
  const t = useTranslations('videoWorkbench.legacy.inputArea');
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {frames.map((frame, idx) => (
        <div key={frame.id} className="relative group shrink-0">
          <FrameCard
            frame={frame}
            frameId={frame.id}
            label={`${frame.duration}s`}
            onFileUpload={onFrameFileUpload}
            compact
          />
          {frames.length > 1 && (
            <button
              type="button"
              className="absolute -right-1 -top-1 hidden group-hover:flex size-4 items-center justify-center rounded-full bg-destructive text-white"
              onClick={(e) => { e.stopPropagation(); onRemoveFrame(frame.id); }}
            >
              <X className="size-2.5" />
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="flex min-w-[56px] shrink-0 flex-col items-center gap-0.5 rounded-md border border-dashed border-white/16 bg-white/[0.035] p-1 transition-colors hover:border-white/45 hover:bg-white/[0.07]"
        onClick={onAddFrame}
      >
        <div className="flex size-10 items-center justify-center">
          <Plus className="size-4 text-white/54" />
        </div>
        <span className="text-[9px] text-white/54">
          {t('frameIndex', { index: frames.length + 1 })}
        </span>
      </button>

      {frames.length > 0 && (
        <button
          type="button"
          className="ml-2 shrink-0 text-[10px] text-white/44 hover:text-red-200"
          onClick={onClearAll}
        >
          {t('clearAll')}
        </button>
      )}
    </div>
  );
}

function FrameCard({
  frame,
  frameId,
  label,
  onFileUpload,
  compact,
}: {
  frame: FrameSlot | null;
  frameId: string;
  label: string;
  onFileUpload: (frameId: string, files: File[]) => void;
  compact?: boolean;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(frameId, Array.from(files));
    }
    e.target.value = '';
  };

  const size = compact ? 'size-10' : 'size-12';
  const padding = compact ? 'p-1' : 'p-2';
  const minW = compact ? 'min-w-[56px]' : 'min-w-[64px]';

  return (
    <label className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-white/14 bg-white/[0.035] ${padding} transition-colors hover:border-white/45 hover:bg-white/[0.07] ${minW}`}>
      {frame?.material ? (
        frame.material.type === 'video' ? (
          <video src={frame.material.url} muted preload="metadata" className={`${size} rounded object-cover`} />
        ) : (
          <img src={frame.material.url} alt="" className={`${size} rounded object-cover`} />
        )
      ) : (
        <div className={`flex ${size} items-center justify-center rounded border border-dashed border-white/16 bg-black/10`}>
          <Upload className="size-3.5 text-white/48" />
        </div>
      )}
      <span className="text-[10px] text-white/54">{label}</span>
      <input
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </label>
  );
}
