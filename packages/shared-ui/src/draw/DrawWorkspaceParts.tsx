'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  Download,
  Film,
  Frame,
  ImageIcon,
  LayoutGrid,
  Loader2,
  MousePointer2,
  Palette,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Type,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import type { Conversation, ModelConfigItem } from '@autix/shared-store';
import { ModelPickerPopover } from '../chat/ModelPickerPopover';
import type { VideoNodeOverlayView } from './VideoNodeOverlay';
import {
  imageInputHandlePoint,
  imageOutputHandlePoint,
  smoothEdgeRoute,
  videoInputHandlePoint,
  videoLinkLabelText,
} from './draw-canvas-geometry';
import { DRAW_COLOR_SWATCHES } from './draw-constants';
import { hasImageUrl } from './draw-image-helpers';
import type {
  CanvasConnectionDrag,
  CanvasImageNodeView,
  CanvasImageRef,
  ChatMessage,
  ComposerImage,
  GenerationMode,
  SelectionInfo,
  Tool,
  Tr,
  VideoLinkEditorInfo,
  VideoLinkLabelInfo,
} from './draw-types';
import { tr } from './draw-workspace-helpers';

export function ConversationMenu(props: {
  t: Tr;
  open: boolean;
  activeConversationId: string;
  conversations: Conversation[];
  search: string;
  loading: boolean;
  onSearch: (value: string) => void;
  onToggle: () => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
}) {
  const { t } = props;
  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-1">
        <IconBtn title={t('chat.newConversation')} onClick={props.onCreate}>
          {props.loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </IconBtn>
        <IconBtn title={t('chat.history')} onClick={props.onToggle}><ChevronDown className="size-4" /></IconBtn>
      </div>
      {props.open && (
        <div className="fixed right-4 top-20 z-[80] w-[min(340px,calc(100vw-32px))] rounded-2xl border border-white/12 bg-black/[0.95] p-4 text-white shadow-[0_28px_100px_rgba(0,0,0,0.58)] backdrop-blur-xl xl:absolute xl:right-0 xl:top-10">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 truncate text-lg font-semibold">{t('chat.history')}</h2>
              <span className="rounded-full border border-white/10 bg-white/[0.08] px-2 py-0.5 text-xs font-medium text-white/55">
                {props.conversations.length}
              </span>
            </div>
            <button type="button" onClick={props.onCreate} className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90">
              {t('chat.newConversation')}
            </button>
          </div>
          <label className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-3 text-white/40">
            <Search className="size-4" />
            <input
              value={props.search}
              onChange={(event) => props.onSearch(event.target.value)}
              placeholder={t('chat.search')}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </label>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {props.conversations.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/45">{t('chat.emptyHistory')}</p>
            ) : (
              props.conversations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => props.onSelect(item.id)}
                  className={`block w-full truncate rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    item.id === props.activeConversationId
                      ? 'bg-white/[0.12] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                      : 'text-white/68 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.title?.trim() || t('untitled')}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DrawModelPicker(props: {
  t: Tr;
  models: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  loading: boolean;
  triggerClassName?: string;
  onChange: (id: string | null) => void;
}) {
  const label = props.loading
    ? tr(props.t, 'chat.modelLoading', '加载模型…')
    : props.selectedModel?.name ?? tr(props.t, 'chat.modelEmpty', '暂无模型');
  const triggerClassName = props.triggerClassName ?? 'inline-flex h-8 min-w-0 max-w-[260px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.08] px-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <ModelPickerPopover
      candidates={props.models}
      value={props.selectedModelId}
      onChange={props.onChange}
      labels={{
        searchPlaceholder: tr(props.t, 'chat.modelSearchPlaceholder', '搜索模型'),
        empty: tr(props.t, 'chat.modelEmptyResult', '没有匹配的模型'),
      }}
      trigger={(
        <button
          type="button"
          disabled={props.loading || props.models.length === 0}
          className={triggerClassName}
        >
          {props.loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-white/50" />
        </button>
      )}
    />
  );
}

export function CanvasConnectionHandles(props: {
  images: CanvasImageNodeView[];
  videos: VideoNodeOverlayView[];
  drag: CanvasConnectionDrag | null;
  onStartConnection: (sourceId: string, point: { x: number; y: number }) => void;
}) {
  if (props.images.length === 0 && props.videos.length === 0 && !props.drag) return null;
  const previewPath = props.drag
    ? smoothEdgeRoute(
        { x: props.drag.sourceX, y: props.drag.sourceY, side: 'right' },
        { x: props.drag.target?.x ?? props.drag.pointerX, y: props.drag.target?.y ?? props.drag.pointerY, side: 'left' },
      ).path
    : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[34] overflow-hidden">
      {previewPath && (
        <svg className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
          <path
            d={previewPath}
            fill="none"
            stroke="#f8fafc"
            strokeDasharray="7 7"
            strokeLinecap="round"
            strokeWidth="2"
            opacity="0.72"
          />
        </svg>
      )}

      {props.images.map((image) => {
        const input = imageInputHandlePoint(image);
        const output = imageOutputHandlePoint(image);
        const activeTarget = props.drag?.target?.id === image.elementId;
        return (
          <div key={image.elementId}>
            <span
              className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-black shadow-[0_4px_14px_rgba(0,0,0,0.45)] ${
                activeTarget ? 'border-white ring-4 ring-violet-400/35' : 'border-violet-300/70'
              }`}
              style={{ left: input.x, top: input.y }}
            />
            <button
              type="button"
              title="连接图片"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                props.onStartConnection(image.elementId, output);
              }}
              className="pointer-events-auto absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-100 bg-violet-500 shadow-[0_6px_18px_rgba(124,58,237,0.42)] transition hover:scale-125 hover:bg-violet-300"
              style={{ left: output.x, top: output.y }}
            />
          </div>
        );
      })}

      {props.videos.map((video) => {
        const input = videoInputHandlePoint(video);
        const activeTarget = props.drag?.target?.id === video.id;
        return (
          <span
            key={video.id}
            className={`absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-black shadow-[0_6px_18px_rgba(16,185,129,0.32)] ${
              activeTarget ? 'border-white ring-4 ring-emerald-300/35' : 'border-emerald-300/80'
            }`}
            style={{ left: input.x, top: input.y }}
          />
        );
      })}
    </div>
  );
}

export function VideoCanvasEdges(props: {
  edges: VideoLinkLabelInfo[];
  onSelectEdge: (edge: VideoLinkLabelInfo) => void;
  onDeleteEdge: (edgeId: string) => void;
}) {
  if (props.edges.length === 0) return null;

  return (
    <>
    <div className="pointer-events-none absolute inset-0 z-[22] overflow-hidden">
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <defs>
          <marker
            id="video-edge-arrow-sequence"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 1 1 L 9 5 L 1 9 z" fill="#8b5cf6" />
          </marker>
          <marker
            id="video-edge-arrow-input"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 1 1 L 9 5 L 1 9 z" fill="#10b981" />
          </marker>
        </defs>
        {props.edges.map((edge) => {
          const sequence = edge.role === 'sequence';
          const color = sequence ? '#8b5cf6' : '#10b981';
          return (
            <g key={edge.id}>
              <path
                d={edge.path}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                strokeLinecap="round"
                strokeLinejoin="round"
                data-video-link-control="true"
                className="pointer-events-auto cursor-pointer"
                onClick={() => props.onSelectEdge(edge)}
              />
              <path
                d={edge.path}
                fill="none"
                stroke={color}
                strokeWidth={sequence ? 2.6 : 2}
                strokeDasharray={sequence ? undefined : '7 8'}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={`url(#video-edge-arrow-${sequence ? 'sequence' : 'input'})`}
                opacity={sequence ? 0.92 : 0.62}
                style={{ filter: sequence ? 'drop-shadow(0 6px 12px rgba(124,58,237,0.34))' : undefined }}
              />
              <circle cx={edge.startX} cy={edge.startY} r="5" fill="#050505" stroke={color} strokeWidth="2.5" />
              <circle cx={edge.endX} cy={edge.endY} r="4" fill={color} stroke="#050505" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
    </div>
    <div className="pointer-events-none absolute inset-0 z-[36] overflow-hidden">
      {props.edges.filter((edge) => edge.role === 'sequence' && edge.hasPromptField).map((edge) => (
        <div
          key={edge.id}
          data-video-link-control="true"
          className={`pointer-events-auto absolute flex w-80 max-w-[calc(100%-32px)] -translate-y-1/2 items-stretch overflow-hidden rounded-lg border text-[11px] font-semibold text-white shadow-[0_12px_34px_rgba(0,0,0,0.38)] backdrop-blur transition hover:scale-[1.02] ${
            edge.hasPromptField
              ? 'border-violet-200/40 bg-violet-500/90'
              : 'border-white/20 bg-neutral-950/88'
          }`}
          style={{
            left: `max(16px, min(${Math.round(edge.screenX - 160)}px, calc(100% - 336px)))`,
            top: `clamp(74px, ${Math.round(edge.screenY)}px, calc(100% - 18px))`,
          }}
        >
          <button
            type="button"
            title="编辑镜头描述"
            onClick={() => props.onSelectEdge(edge)}
            className="min-w-0 flex-1 break-words px-2.5 py-1 text-left leading-4"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
              overflow: 'hidden',
            }}
          >
            {videoLinkLabelText(edge)}
          </button>
          <button
            type="button"
            title="删除连接线"
            onClick={(event) => {
              event.stopPropagation();
              props.onDeleteEdge(edge.id);
            }}
            className="grid size-6 shrink-0 place-items-center border-l border-white/12 text-white/62 transition hover:bg-red-500/20 hover:text-red-100"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}
    </div>
    </>
  );
}

export function IconBtn({ title, onClick, children }: { title: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className="grid size-8 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white">
      {children}
    </button>
  );
}

export function DockBtn({ title, active, dot, onClick, children }: { title: string; active?: boolean; dot?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`relative grid size-10 place-items-center rounded-lg transition ${active ? 'bg-white text-black' : 'text-white/68 hover:bg-white/10 hover:text-white'}`}
    >
      {children}
      {dot && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />}
    </button>
  );
}

export function BottomDock(props: {
  t: Tr;
  tool: Tool;
  mode: GenerationMode;
  strokeColor: string;
  onSelect: () => void;
  onFrame: () => void;
  onUpload: () => void;
  onRectangle: () => void;
  onPen: () => void;
  onText: () => void;
  onGenImage: () => void;
  onGenVideo: () => void;
  onArrangeVideo: () => void;
  onStrokeColorChange: (color: string) => void;
}) {
  const { t, tool } = props;
  const arrangeVideoTitle = tr(t, 'dock.arrangeVideo', '一键排版');
  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-white/12 bg-black/90 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <DockBtn title={t('dock.select')} active={tool === 'selection'} onClick={props.onSelect}><MousePointer2 className="size-5" /></DockBtn>
      <DockBtn title={t('dock.frame')} active={tool === 'frame'} onClick={props.onFrame}><Frame className="size-5" /></DockBtn>
      <DockBtn title={t('dock.upload')} onClick={props.onUpload}><Upload className="size-5" /></DockBtn>
      <span className="mx-1 h-6 w-px bg-white/10" />
      <DockBtn title={t('dock.rectangle')} active={tool === 'rectangle'} onClick={props.onRectangle}><Square className="size-5" /></DockBtn>
      <DockBtn title={t('dock.pen')} active={tool === 'freedraw'} onClick={props.onPen}><Pencil className="size-5" /></DockBtn>
      <DockBtn title={t('dock.text')} active={tool === 'text'} onClick={props.onText}><Type className="size-5" /></DockBtn>
      <span className="mx-1 h-6 w-px bg-white/10" />
      <div className="flex items-center gap-1 px-1" title={tr(t, 'dock.color', '颜色')}>
        <Palette className="size-4 shrink-0 text-white/45" />
        {DRAW_COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => props.onStrokeColorChange(color)}
            className={`grid size-6 shrink-0 place-items-center rounded-full border transition ${props.strokeColor === color ? 'border-white' : 'border-white/20 hover:border-white/60'}`}
          >
            <span className="size-3.5 rounded-full border border-black/20" style={{ backgroundColor: color }} />
          </button>
        ))}
      </div>
      <span className="mx-1 h-6 w-px bg-white/10" />
      <DockBtn title={t('dock.genImage')} active={props.mode === 'image'} onClick={props.onGenImage}><ImageIcon className="size-5" /></DockBtn>
      <DockBtn title={arrangeVideoTitle} onClick={props.onArrangeVideo}><LayoutGrid className="size-5" /></DockBtn>
      <DockBtn title={t('dock.genVideo')} active={props.mode === 'video'} onClick={props.onGenVideo}><Video className="size-5" /></DockBtn>
    </div>
  );
}

export function ContextualToolbar(props: {
  t: Tr;
  info: SelectionInfo;
  onQuickEdit: () => void;
  onUpscale: () => void;
  onRemoveBg: () => void;
  onEraser: () => void;
  onFitSize: () => void;
  onDownload: () => void;
}) {
  const { t, info } = props;
  const left = Math.max(16, info.screenX);
  const top = Math.max(64, info.screenY - 56);
  const items: Array<{ label: string; onClick: () => void }> = [
    { label: t('context.quickEdit'), onClick: props.onQuickEdit },
    { label: t('context.upscale'), onClick: props.onUpscale },
    { label: t('context.removeBg'), onClick: props.onRemoveBg },
    { label: t('context.eraser'), onClick: props.onEraser },
    { label: t('context.fitSize'), onClick: props.onFitSize },
  ];
  return (
    <>
      <div className="pointer-events-auto absolute z-30 flex max-w-[calc(100%-32px)] items-center gap-0.5 overflow-x-auto rounded-xl border border-white/12 bg-black/90 px-1.5 py-1 text-sm shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl" style={{ left, top }}>
        {items.map((item) => (
          <button key={item.label} type="button" onClick={item.onClick} className="shrink-0 rounded-md px-2 py-1 font-medium text-white/78 hover:bg-white/10 hover:text-white">
            {item.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
        <IconBtn title={t('context.download')} onClick={props.onDownload}><Download className="size-4" /></IconBtn>
      </div>
      <div className="pointer-events-none absolute z-30 flex items-center gap-2 text-xs font-medium text-primary" style={{ left, top: top + 44 }}>
        <ImageIcon className="size-3.5" /> {info.label}
        <span className="text-white/45">{info.width} x {info.height}</span>
      </div>
    </>
  );
}

export function QuickEditBox(props: {
  t: Tr;
  info: SelectionInfo;
  value: string;
  generating: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { t, info } = props;
  const left = Math.max(16, info.screenX);
  const imageBottom = info.screenY + info.height * info.zoom;
  const top = Math.max(72, imageBottom + 12);
  const width = Math.min(460, Math.max(260, info.width * info.zoom));
  const canSubmit = !props.generating && props.value.trim().length > 0;
  return (
    <div
      className="pointer-events-auto absolute z-30 flex items-center gap-1.5 rounded-xl border border-white/12 bg-black/90 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      style={{ left, top, width }}
    >
      <Wand2 className="ml-1 size-4 shrink-0 text-primary" />
      <input
        autoFocus
        value={props.value}
        disabled={props.generating}
        onChange={(event) => props.onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (canSubmit) props.onSubmit();
          } else if (event.key === 'Escape') {
            props.onClose();
          }
        }}
        placeholder={t('context.quickEditPlaceholder')}
        className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white placeholder:text-white/40 focus:outline-none"
      />
      <button
        type="button"
        title={t('context.quickEditSubmit')}
        onClick={props.onSubmit}
        disabled={!canSubmit}
        className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-black transition hover:bg-white/90 disabled:opacity-40"
      >
        {props.generating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </button>
      <IconBtn title={t('context.close')} onClick={props.onClose}><X className="size-4" /></IconBtn>
    </div>
  );
}

export function LinePromptEditor(props: {
  edgeId: string;
  value: string;
  left: number;
  top: number;
  optimizing: boolean;
  modelPicker: ReactNode;
  onCommit: (value: string) => void;
  onOptimize: (value: string) => Promise<string | null>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(props.value);

  useEffect(() => {
    setDraft(props.value);
  }, [props.edgeId, props.value]);

  const commit = () => {
    if (draft !== props.value) props.onCommit(draft);
  };
  const canOptimize = draft.trim().length > 0 && !props.optimizing;

  return (
    <div
      data-video-link-editor="true"
      className="pointer-events-auto absolute z-40 w-[min(560px,calc(100%-32px))] rounded-lg border border-white/12 bg-black/[0.92] p-2.5 text-white shadow-[0_18px_64px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      style={{ left: Math.max(16, props.left), top: Math.max(72, props.top) }}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Film className="size-4 shrink-0 text-emerald-200" />
        <span className="text-xs font-semibold text-white/68">镜头描述</span>
        <span className="flex-1" />
        {props.modelPicker}
        <button
          type="button"
          title="删除连接线"
          onMouseDown={(event) => event.preventDefault()}
          onClick={props.onDelete}
          className="grid size-7 place-items-center rounded-md text-white/45 transition hover:bg-red-500/16 hover:text-red-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <textarea
        autoFocus
        rows={8}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            props.onClose();
          }
        }}
        placeholder="描述主体动作、镜头运动、转场、情绪和画面细节"
        className="min-h-40 max-h-72 w-full resize-y rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-2 text-sm leading-5 text-white outline-none placeholder:text-white/34 focus:border-emerald-200/55"
      />
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          title="优化提示词"
          disabled={!canOptimize}
          onMouseDown={(event) => event.preventDefault()}
          onClick={async () => {
            const optimized = await props.onOptimize(draft);
            if (optimized !== null) setDraft(optimized);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-35"
        >
          {props.optimizing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          优化
        </button>
        <button
          type="button"
          title="应用描述"
          onMouseDown={(event) => event.preventDefault()}
          onClick={commit}
          className="grid size-8 place-items-center rounded-md bg-white text-black transition hover:bg-white/90"
        >
          <Send className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function LineActionPopover(props: {
  edge: VideoLinkEditorInfo;
  left: number;
  top: number;
  onAddPrompt?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-video-link-editor="true"
      className="pointer-events-auto absolute z-40 flex items-center gap-1.5 rounded-lg border border-white/12 bg-black/[0.92] p-1.5 text-white shadow-[0_18px_64px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      style={{ left: Math.max(16, props.left), top: Math.max(72, props.top) }}
    >
      <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.06] px-2 text-xs font-semibold text-white/70">
        <Film className="size-3.5 text-emerald-200" />
        {props.edge.role === 'input' ? '输入' : '连接线'}
      </span>
      {props.onAddPrompt && (
        <button
          type="button"
          title="添加分镜描述"
          onClick={props.onAddPrompt}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <Wand2 className="size-3.5" />
          添加描述
        </button>
      )}
      <button
        type="button"
        title="删除连接线"
        onClick={props.onDelete}
        className="grid size-7 place-items-center rounded-md text-white/45 transition hover:bg-red-500/16 hover:text-red-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function ReferenceStrip(props: {
  t: Tr;
  selectedImages: CanvasImageRef[];
  composerImages: ComposerImage[];
  onRemoveComposer: (id: string) => void;
}) {
  const selectedImages = props.selectedImages.filter(hasImageUrl);
  const composerImages = props.composerImages.filter(hasImageUrl);
  const count = selectedImages.length + composerImages.length;
  if (count === 0) return null;
  return (
    <div className="mb-2 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/50">
        <ImageIcon className="size-3.5" /> {props.t('chat.referenceImages', { count })}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {selectedImages.map((image) => (
          <div key={image.elementId} className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-white/35">
            <img src={image.url} alt="" className="size-full object-cover" />
          </div>
        ))}
        {composerImages.map((image) => (
          <div key={image.id} className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-white/12">
            <img src={image.url} alt="" className="size-full object-cover" />
            <button
              type="button"
              title={props.t('chat.removeAttachment')}
              onClick={() => props.onRemoveComposer(image.id)}
              className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/70 text-white"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageBubble({ message, t, onImageClick }: { message: ChatMessage; t: Tr; onImageClick?: (url: string) => void }) {
  const isUser = message.role === 'user';
  return (
    <div className={`space-y-2 ${isUser ? 'text-right' : ''}`}>
      {message.pending ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-white/45"><Sparkles className="size-3.5 animate-pulse" /> {t('chat.thinking')}</span>
      ) : (
        <>
          {message.images && message.images.length > 0 && (
            <div className={`grid gap-2 ${message.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {message.images.map((url) => (
                <button key={url} type="button" title={t('chat.locate')} onClick={() => onImageClick?.(url)} className="block w-full">
                  <img src={url} alt="" className="aspect-square w-full rounded-xl border border-white/12 object-cover transition hover:ring-2 hover:ring-white/45" />
                </button>
              ))}
            </div>
          )}
          {message.videos && message.videos.length > 0 && (
            <div className="space-y-2">
              {message.videos.map((url) => (
                <video key={url} src={url} controls className="w-full rounded-xl border border-white/12" />
              ))}
            </div>
          )}
          {message.text && (
            <p className={`inline-block max-w-full rounded-2xl px-3 py-2 text-left text-sm leading-6 ${
              message.error
                ? 'border border-red-300/20 bg-red-500/[0.12] text-red-200'
                : isUser
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/82'
            }`}>
              {message.text}
            </p>
          )}
          {!isUser && !message.error && (
            <div className="flex items-center gap-1 text-white/45">
              <IconBtn title={t('chat.thumbUp')}><ThumbsUp className="size-3.5" /></IconBtn>
              <IconBtn title={t('chat.thumbDown')}><ThumbsDown className="size-3.5" /></IconBtn>
            </div>
          )}
        </>
      )}
    </div>
  );
}
