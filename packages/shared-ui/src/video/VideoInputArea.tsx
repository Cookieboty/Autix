'use client';

import { Plus, X, ArrowRight, Upload } from 'lucide-react';
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
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onAdd(Array.from(files));
    }
    e.target.value = '';
  };

  if (materials.length === 0) {
    return (
      <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:bg-accent transition-colors cursor-pointer">
        <div className="flex size-10 items-center justify-center rounded-md border border-dashed border-border">
          <Plus className="size-4" />
        </div>
        <span>参考内容</span>
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
          {mat.type === 'image' ? (
            <img src={mat.url} alt="" className="size-12 rounded-md object-cover border border-border" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-md border border-border bg-muted text-[9px] text-muted-foreground">
              {mat.type === 'video' ? '视频' : '音频'}
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
        <label className="flex size-12 items-center justify-center rounded-md border border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer">
          <Plus className="size-4 text-muted-foreground" />
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
  onFileUpload,
}: {
  firstFrame: FrameSlot | null;
  lastFrame: FrameSlot | null;
  onFileUpload: (frameId: string, files: File[]) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <FrameCard
        frame={firstFrame}
        frameId={firstFrame?.id ?? 'first'}
        label="首帧"
        onFileUpload={onFileUpload}
      />
      <ArrowRight className="size-4 text-muted-foreground shrink-0" />
      <FrameCard
        frame={lastFrame}
        frameId={lastFrame?.id ?? 'last'}
        label="尾帧"
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
        className="flex flex-col items-center gap-0.5 rounded-md border border-dashed border-border p-1 hover:border-primary/40 transition-colors min-w-[56px] shrink-0"
        onClick={onAddFrame}
      >
        <div className="flex size-10 items-center justify-center">
          <Plus className="size-4 text-muted-foreground" />
        </div>
        <span className="text-[9px] text-muted-foreground">
          第{frames.length + 1}帧
        </span>
      </button>

      {frames.length > 0 && (
        <button
          type="button"
          className="ml-2 text-[10px] text-muted-foreground hover:text-destructive shrink-0"
          onClick={onClearAll}
        >
          全部清空
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
    <label className={`flex flex-col items-center gap-0.5 rounded-lg border border-border ${padding} hover:border-primary/40 transition-colors ${minW} cursor-pointer`}>
      {frame?.material ? (
        <img src={frame.material.url} alt="" className={`${size} rounded object-cover`} />
      ) : (
        <div className={`flex ${size} items-center justify-center rounded border border-dashed border-border`}>
          <Upload className="size-3.5 text-muted-foreground" />
        </div>
      )}
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </label>
  );
}
