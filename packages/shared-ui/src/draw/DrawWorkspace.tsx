'use client';

// Reference-matched creative canvas: left Excalidraw board (native chrome
// hidden in favor of a custom bottom dock + contextual toolbar), right chat
// panel whose assistant turns generate images that land on the canvas.
// Positions persist server-side via the canvas board API (drawBoardActions).

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Frame,
  ImageIcon,
  Layers,
  Loader2,
  MousePointer2,
  PanelRightClose,
  Pencil,
  Plus,
  Send,
  Share2,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Type,
  Upload,
  Video,
  Wand2,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { drawBoardActions } from '@autix/shared-store';
import { useRouter } from '../navigation';
import {
  type DrawElement,
  boardStateToScene,
  sceneSignature,
  sceneToBoardState,
} from './draw-scene-mapper';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  { ssr: false },
);

const SAVE_DEBOUNCE_MS = 1200;
const DEFAULT_IMAGE_SIZE = 320;

// Hide Excalidraw's built-in chrome so our custom docks are the only UI.
const HIDE_EXCALIDRAW_UI = `
.draw-canvas .App-menu__left,
.draw-canvas .App-toolbar,
.draw-canvas .layer-ui__wrapper__top-right,
.draw-canvas .footer-center,
.draw-canvas .App-menu_top__left,
.draw-canvas .zoom-actions,
.draw-canvas .undo-redo-buttons,
.draw-canvas .help-icon { display: none !important; }
.draw-canvas .Island { box-shadow: none; }
`;

export interface DrawWorkspaceProps {
  boardId: string;
  /** Optional override; otherwise the default image model is resolved. */
  modelConfigId?: string;
}

type Tool = 'selection' | 'frame' | 'rectangle' | 'freedraw' | 'text' | 'eraser';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  pending?: boolean;
  error?: boolean;
}

interface SelectionInfo {
  screenX: number;
  screenY: number;
  label: string;
  width: number;
  height: number;
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}`;
}

export function DrawWorkspace({ boardId, modelConfigId }: DrawWorkspaceProps) {
  const t = useTranslations('drawWorkspace');
  const router = useRouter();

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const revisionRef = useRef(1);
  const lastSavedSigRef = useRef('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeCountRef = useRef(0);
  const modelIdRef = useRef(modelConfigId ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [ready, setReady] = useState(false);
  const [initialData, setInitialData] = useState<{ elements: DrawElement[]; files: Record<string, unknown> } | null>(null);
  const [tool, setTool] = useState<Tool>('selection');
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [title, setTitle] = useState('Untitled');
  const [credits, setCredits] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [canGenerate, setCanGenerate] = useState(true);
  const [entitlementReason, setEntitlementReason] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict'>('idle');
  const [showUpsell, setShowUpsell] = useState(true);

  // ── Load persisted board ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await drawBoardActions.getState(boardId);
        if (cancelled) return;
        revisionRef.current = data.board.revision;
        setTitle(data.board.title || 'Untitled');
        setCanGenerate(data.entitlement.canGenerate);
        setEntitlementReason(data.entitlement.reason ?? null);
        const scene = boardStateToScene(data.state);
        lastSavedSigRef.current = sceneSignature(scene.elements);
        setInitialData({ elements: scene.elements, files: scene.files });
      } catch {
        setInitialData({ elements: [], files: {} });
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [boardId]);

  // Resolve the image model + credits balance for generation and the top bar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [modelId, balance] = await Promise.all([
          modelIdRef.current ? Promise.resolve(modelIdRef.current) : drawBoardActions.resolveImageModelConfigId(),
          drawBoardActions.getCredits().catch(() => null),
        ]);
        if (cancelled) return;
        if (modelId) modelIdRef.current = modelId;
        if (balance !== null) setCredits(balance);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Persist (debounced, If-Match) ───────────────────────────────────────
  const persist = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const sig = sceneSignature(elements);
    if (sig === lastSavedSigRef.current) return;
    setSaveStatus('saving');
    const state = sceneToBoardState(elements, revisionRef.current, new Date().toISOString());
    try {
      const saved = await drawBoardActions.saveState(boardId, state, revisionRef.current);
      revisionRef.current = saved.boardRevision;
      lastSavedSigRef.current = sig;
      setSaveStatus('saved');
    } catch (error) {
      if (isConflict(error)) {
        const fresh = await drawBoardActions.getState(boardId);
        revisionRef.current = fresh.board.revision;
        const scene = boardStateToScene(fresh.state);
        lastSavedSigRef.current = sceneSignature(scene.elements);
        apiRef.current?.updateScene({ elements: scene.elements as never });
        setSaveStatus('conflict');
      } else {
        setSaveStatus('idle');
      }
    }
  }, [boardId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
  }, [persist]);

  // ── Place a generated / uploaded image ──────────────────────────────────
  const placeImage = useCallback(async (url: string, label: string) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const fileId = newId('file');
    api.addFiles([{ id: fileId as never, dataURL: url as never, mimeType: 'image/png' as never, created: 0 }]);
    const n = placeCountRef.current++;
    const skeleton = mod
      .convertToExcalidrawElements([
        {
          type: 'image',
          fileId: fileId as never,
          x: 80 + (n % 4) * (DEFAULT_IMAGE_SIZE + 24),
          y: 80 + Math.floor(n / 4) * (DEFAULT_IMAGE_SIZE + 24),
          width: DEFAULT_IMAGE_SIZE,
          height: DEFAULT_IMAGE_SIZE,
        },
      ])
      .map((el) => ({ ...el, customData: { assetUrl: url, label } }));
    const current = api.getSceneElements();
    api.updateScene({ elements: [...current, ...skeleton] as never });
    api.scrollToContent(skeleton, { animate: true });
    scheduleSave();
  }, [scheduleSave]);

  // ── Chat submit → generate → place ──────────────────────────────────────
  const submit = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || generating) return;
    if (!canGenerate) {
      setMessages((m) => [...m, { id: newId('m'), role: 'assistant', text: entitlementReason ?? t('actions.generateComingSoon'), error: true }]);
      return;
    }
    const pendingId = newId('m');
    setMessages((m) => [
      ...m,
      { id: newId('m'), role: 'user', text: prompt },
      { id: pendingId, role: 'assistant', text: '', pending: true },
    ]);
    setInput('');
    setGenerating(true);
    try {
      const gen = await drawBoardActions.chatGenerate(boardId, {
        idempotencyKey: newId('idem'),
        prompt,
        modelConfigId: modelIdRef.current,
      });
      const urls = gen.images.map((img) => img.url);
      for (const url of urls) await placeImage(url, prompt);
      setMessages((m) => m.map((msg) => (msg.id === pendingId ? { ...msg, pending: false, text: `${t('chat.done')}：${prompt}`, images: urls } : msg)));
    } catch (error) {
      setMessages((m) => m.map((msg) => (msg.id === pendingId ? { ...msg, pending: false, error: true, text: errorMessage(error) } : msg)));
    } finally {
      setGenerating(false);
    }
  }, [boardId, canGenerate, entitlementReason, generating, input, placeImage, t]);

  // ── Excalidraw change → tool/zoom/selection/save ────────────────────────
  const onChange = useCallback((elements: readonly unknown[], appState: AppStateLike) => {
    setTool(appState.activeTool?.type as Tool);
    setZoom(appState.zoom?.value ?? 1);

    const selectedIds = Object.keys(appState.selectedElementIds ?? {});
    if (selectedIds.length === 1) {
      const el = (elements as DrawElement[]).find((e) => e.id === selectedIds[0]);
      if (el && el.type === 'image') {
        const zoomV = appState.zoom?.value ?? 1;
        setSelection({
          screenX: (el.x + (appState.scrollX ?? 0)) * zoomV,
          screenY: (el.y + (appState.scrollY ?? 0)) * zoomV,
          label: String(el.customData?.label ?? t('title')),
          width: Math.round(el.width),
          height: Math.round(el.height),
        });
      } else {
        setSelection(null);
      }
    } else {
      setSelection(null);
    }
    scheduleSave();
  }, [scheduleSave, t]);

  const setActiveTool = useCallback((next: Tool) => {
    apiRef.current?.setActiveTool({ type: next } as never);
    setTool(next);
  }, []);

  // Video "flow" mode: activate Excalidraw's arrow tool to connect images.
  const startFlowConnection = useCallback(() => {
    apiRef.current?.setActiveTool({ type: 'arrow' } as never);
    setTool('selection');
  }, []);

  const onUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files).slice(0, 6)) {
      if (!file.type.startsWith('image/')) continue;
      const url = await readFileAsDataUrl(file);
      await placeImage(url, file.name);
    }
  }, [placeImage]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f7f6f1] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <style>{HIDE_EXCALIDRAW_UI}</style>

      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-black/5 px-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
            <Wand2 className="size-4" />
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-40 rounded-md bg-transparent px-1 text-sm font-semibold outline-none hover:bg-black/5 focus:bg-black/5 dark:hover:bg-white/10"
          />
          <ChevronDown className="size-4 text-neutral-400" />
          <span className="ml-2 text-xs text-neutral-400">{saveLabel(saveStatus, t)}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold dark:bg-white/10">
            <Zap className="size-3.5 text-amber-500" />
            {credits ?? '—'}
          </div>
          <div className="size-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        {/* Canvas */}
        <main className="draw-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
            <button type="button" onClick={() => router.push('/workbench/image')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white/90 px-3 text-sm font-semibold shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-neutral-900/90">
              <ArrowLeft className="size-4" />
              {t('actions.backToImage')}
            </button>
          </div>

          {ready && initialData ? (
            <Excalidraw
              excalidrawAPI={(api) => {
                apiRef.current = api;
              }}
              initialData={{ elements: initialData.elements as never, files: initialData.files as never }}
              onChange={onChange as never}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-400">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}

          {/* Contextual toolbar over a selected image */}
          {selection && (
            <ContextualToolbar
              t={t}
              info={selection}
              onEraser={() => setActiveTool('eraser')}
              onDownload={() => { /* export selection — browser follow-up */ }}
            />
          )}

          {/* Bottom-left zoom + layers */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-lg border border-black/10 bg-white/90 px-2 py-1 text-xs shadow-sm backdrop-blur dark:border-white/10 dark:bg-neutral-900/90">
            <Layers className="size-4 text-neutral-500" />
            <span className="tabular-nums font-medium">{Math.round(zoom * 100)}%</span>
          </div>

          {/* Bottom-center tool dock */}
          <BottomDock
            t={t}
            tool={tool}
            onSelect={() => setActiveTool('selection')}
            onFrame={() => setActiveTool('frame')}
            onUpload={() => fileInputRef.current?.click()}
            onRectangle={() => setActiveTool('rectangle')}
            onPen={() => setActiveTool('freedraw')}
            onText={() => setActiveTool('text')}
            onGenImage={() => composerRef.current?.focus()}
            onGenVideo={startFlowConnection}
            onGenText={() => composerRef.current?.focus()}
          />
        </main>

        {/* Chat panel */}
        <aside className="flex max-h-[45svh] w-full shrink-0 flex-col border-t border-black/5 bg-white xl:h-full xl:max-h-none xl:w-[420px] xl:border-l xl:border-t-0 dark:border-white/10 dark:bg-neutral-950">
          <div className="flex items-center gap-2 border-b border-black/5 px-5 py-3.5 dark:border-white/10">
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{firstUserPrompt(messages) ?? t('title')}</h1>
            <IconBtn title={t('chat.newChat')} onClick={() => setMessages([])}><Plus className="size-4" /></IconBtn>
            <IconBtn title={t('chat.share')}><Share2 className="size-4" /></IconBtn>
            <IconBtn title={t('chat.collapse')}><PanelRightClose className="size-4" /></IconBtn>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
              <Sparkles className="size-3.5" /> GPT Image 2
            </div>
            {messages.length === 0 ? (
              <p className="mt-10 text-center text-sm text-neutral-400">{t('prompt.placeholder')}</p>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} message={msg} t={t} />)
            )}
          </div>

          {!canGenerate && showUpsell && (
            <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5 text-xs text-amber-800 dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-200">
              <Sparkles className="size-4 shrink-0" />
              <span className="flex-1">{entitlementReason ?? t('actions.generateComingSoon')}</span>
              <button type="button" onClick={() => setShowUpsell(false)} className="text-amber-500">×</button>
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-black/5 p-4 dark:border-white/10">
            {selection && (
              <div className="mb-2 inline-flex max-w-full items-center gap-1.5 truncate rounded-lg bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
                <ImageIcon className="size-3.5" /> <span className="truncate">{selection.label}</span>
              </div>
            )}
            <div className="rounded-2xl border border-black/10 bg-neutral-50 p-2 focus-within:border-primary dark:border-white/10 dark:bg-neutral-900">
              <textarea
                ref={composerRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder={t('prompt.placeholder')}
                rows={1}
                className="max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
              />
              <div className="flex items-center gap-1 px-1">
                <IconBtn title={t('chat.attach')}><Plus className="size-4" /></IconBtn>
                <IconBtn title={t('chat.library')}><ImageIcon className="size-4" /></IconBtn>
                <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10">
                  <span className="grid size-4 place-items-center rounded-full bg-neutral-200 dark:bg-neutral-700" /> {t('chat.agent')} <ChevronDown className="size-3" />
                </button>
                <button
                  type="button"
                  disabled={generating || !input.trim()}
                  onClick={() => void submit()}
                  className="ml-auto inline-flex size-8 items-center justify-center rounded-full bg-neutral-900 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
                >
                  {generating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onUpload(e.target.files)} />
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

interface AppStateLike {
  activeTool?: { type?: string };
  zoom?: { value?: number };
  scrollX?: number;
  scrollY?: number;
  selectedElementIds?: Record<string, boolean>;
}

type Tr = (key: string, values?: Record<string, string | number>) => string;

function IconBtn({ title, onClick, children }: { title: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className="grid size-8 place-items-center rounded-md text-neutral-500 transition hover:bg-black/5 hover:text-neutral-900 dark:hover:bg-white/10 dark:hover:text-white">
      {children}
    </button>
  );
}

function DockBtn({ title, active, dot, onClick, children }: { title: string; active?: boolean; dot?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`relative grid size-10 place-items-center rounded-lg transition ${active ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10'}`}
    >
      {children}
      {dot && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />}
    </button>
  );
}

function BottomDock(props: {
  t: Tr;
  tool: Tool;
  onSelect: () => void;
  onFrame: () => void;
  onUpload: () => void;
  onRectangle: () => void;
  onPen: () => void;
  onText: () => void;
  onGenImage: () => void;
  onGenVideo: () => void;
  onGenText: () => void;
}) {
  const { t, tool } = props;
  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-black/10 bg-white/95 p-1.5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-neutral-900/95">
      <DockBtn title={t('dock.select')} active={tool === 'selection'} onClick={props.onSelect}><MousePointer2 className="size-5" /></DockBtn>
      <DockBtn title={t('dock.frame')} active={tool === 'frame'} onClick={props.onFrame}><Frame className="size-5" /></DockBtn>
      <DockBtn title={t('dock.upload')} onClick={props.onUpload}><Upload className="size-5" /></DockBtn>
      <span className="mx-1 h-6 w-px bg-black/10 dark:bg-white/10" />
      <DockBtn title={t('dock.rectangle')} active={tool === 'rectangle'} onClick={props.onRectangle}><Square className="size-5" /></DockBtn>
      <DockBtn title={t('dock.pen')} active={tool === 'freedraw'} onClick={props.onPen}><Pencil className="size-5" /></DockBtn>
      <DockBtn title={t('dock.text')} active={tool === 'text'} onClick={props.onText}><Type className="size-5" /></DockBtn>
      <span className="mx-1 h-6 w-px bg-black/10 dark:bg-white/10" />
      <DockBtn title={t('dock.genImage')} onClick={props.onGenImage}><ImageIcon className="size-5" /></DockBtn>
      <DockBtn title={t('dock.genVideo')} onClick={props.onGenVideo}><Video className="size-5" /></DockBtn>
      <DockBtn title={t('dock.genText')} dot onClick={props.onGenText}><Wand2 className="size-5" /></DockBtn>
    </div>
  );
}

function ContextualToolbar({ t, info, onEraser, onDownload }: { t: Tr; info: SelectionInfo; onEraser: () => void; onDownload: () => void }) {
  const left = Math.max(16, info.screenX);
  const top = Math.max(64, info.screenY - 56);
  const items: Array<{ label: string; onClick?: () => void }> = [
    { label: t('context.quickEdit') },
    { label: t('context.upscale') },
    { label: t('context.removeBg') },
    { label: t('context.eraser'), onClick: onEraser },
    { label: t('context.editElement') },
    { label: t('context.editText') },
    { label: t('context.multiAngle') },
    { label: t('context.moveObject') },
  ];
  return (
    <>
      <div className="pointer-events-auto absolute z-30 flex items-center gap-0.5 rounded-xl border border-black/10 bg-white/95 px-1.5 py-1 text-sm shadow-lg backdrop-blur dark:border-white/10 dark:bg-neutral-900/95" style={{ left, top }}>
        {items.map((item) => (
          <button key={item.label} type="button" onClick={item.onClick} className="rounded-md px-2 py-1 font-medium text-neutral-700 hover:bg-black/5 dark:text-neutral-200 dark:hover:bg-white/10">
            {item.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
        <IconBtn title={t('context.download')} onClick={onDownload}><Download className="size-4" /></IconBtn>
      </div>
      <div className="pointer-events-none absolute z-30 flex items-center gap-2 text-xs font-medium text-primary" style={{ left, top: top + 44 }}>
        <ImageIcon className="size-3.5" /> {info.label}
        <span className="text-neutral-400">{info.width} × {info.height}</span>
      </div>
    </>
  );
}

function MessageBubble({ message, t }: { message: ChatMessage; t: Tr }) {
  const isUser = message.role === 'user';
  if (isUser) {
    return <p className="text-sm font-semibold">{message.text}</p>;
  }
  return (
    <div className="space-y-2">
      {message.pending ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-neutral-400"><Sparkles className="size-3.5 animate-pulse" /> …</span>
      ) : (
        <>
          {message.images && message.images.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              {message.images.map((url) => (
                <img key={url} src={url} alt="" className="w-full rounded-xl border border-black/5 object-cover dark:border-white/10" />
              ))}
            </div>
          )}
          {message.text && <p className={`text-sm leading-6 ${message.error ? 'text-red-500' : 'text-neutral-700 dark:text-neutral-200'}`}>{message.text}</p>}
          {!message.error && (
            <div className="flex items-center gap-1 text-neutral-400">
              <IconBtn title={t('chat.thumbUp')}><ThumbsUp className="size-3.5" /></IconBtn>
              <IconBtn title={t('chat.thumbDown')}><ThumbsDown className="size-3.5" /></IconBtn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function firstUserPrompt(messages: ChatMessage[]): string | null {
  return messages.find((m) => m.role === 'user')?.text ?? null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('file-read-failed'));
    reader.readAsDataURL(file);
  });
}

function isConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 409,
  );
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { msg?: string; message?: string };
    return e.msg ?? e.message ?? '生成失败';
  }
  return '生成失败';
}

function saveLabel(status: 'idle' | 'saving' | 'saved' | 'conflict', t: Tr): string {
  if (status === 'saving') return t('status.saving');
  if (status === 'saved') return t('status.saved');
  if (status === 'conflict') return t('status.conflict');
  return '';
}
