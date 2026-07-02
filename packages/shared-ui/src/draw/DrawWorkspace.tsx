'use client';

// Left: Excalidraw infinite canvas. Right: chat panel whose assistant turns
// generate one or more images that are placed onto the canvas (positions are
// persisted server-side via the canvas board API). A mode toggle switches
// between free image placement and video flow (Excalidraw bound arrows).

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, GitBranch, ImageIcon, Loader2, Send, Sparkles } from 'lucide-react';
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

export interface DrawWorkspaceProps {
  boardId: string;
  /** Default image model config used for chat-driven generation. */
  modelConfigId: string;
}

type Mode = 'image' | 'video';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  pending?: boolean;
  error?: string;
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

  const [ready, setReady] = useState(false);
  const [initialData, setInitialData] = useState<{ elements: DrawElement[]; files: Record<string, unknown> } | null>(null);
  const [mode, setMode] = useState<Mode>('image');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [canGenerate, setCanGenerate] = useState(true);
  const [entitlementReason, setEntitlementReason] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict'>('idle');

  // ── Load persisted board ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await drawBoardActions.getState(boardId);
        if (cancelled) return;
        revisionRef.current = data.board.revision;
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
        // Reload authoritative scene and reapply.
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

  // ── Place a generated image onto the canvas ─────────────────────────────
  const placeImage = useCallback(async (url: string) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const fileId = newId('file') as unknown as string;
    const created = 0;
    api.addFiles([
      { id: fileId as never, dataURL: url as never, mimeType: 'image/png' as never, created },
    ]);
    const n = placeCountRef.current++;
    const skeleton = mod.convertToExcalidrawElements([
      {
        type: 'image',
        fileId: fileId as never,
        x: 80 + (n % 4) * (DEFAULT_IMAGE_SIZE + 24),
        y: 80 + Math.floor(n / 4) * (DEFAULT_IMAGE_SIZE + 24),
        width: DEFAULT_IMAGE_SIZE,
        height: DEFAULT_IMAGE_SIZE,
      },
    ]).map((el) => ({ ...el, customData: { assetUrl: url } }));
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
      setMessages((m) => [...m, { id: newId('m'), role: 'assistant', text: entitlementReason ?? t('actions.generateComingSoon'), error: 'membership' }]);
      return;
    }
    const userMsg: ChatMessage = { id: newId('m'), role: 'user', text: prompt };
    const pendingMsg: ChatMessage = { id: newId('m'), role: 'assistant', text: '', pending: true };
    setMessages((m) => [...m, userMsg, pendingMsg]);
    setInput('');
    setGenerating(true);
    try {
      const gen = await drawBoardActions.chatGenerate(boardId, {
        idempotencyKey: newId('idem'),
        prompt,
        modelConfigId,
      });
      const urls = gen.images.map((img) => img.url);
      for (const url of urls) await placeImage(url);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingMsg.id ? { ...msg, pending: false, text: t('status.ready'), images: urls } : msg,
        ),
      );
    } catch (error) {
      const text = errorMessage(error);
      setMessages((m) => m.map((msg) => (msg.id === pendingMsg.id ? { ...msg, pending: false, error: text, text } : msg)));
    } finally {
      setGenerating(false);
    }
  }, [boardId, canGenerate, entitlementReason, generating, input, modelConfigId, placeImage, t]);

  const onExcalidrawChange = useCallback(
    (elements: readonly unknown[]) => {
      void elements;
      scheduleSave();
    },
    [scheduleSave],
  );

  const toggleMode = useCallback((next: Mode) => {
    setMode(next);
    const api = apiRef.current;
    if (!api) return;
    // Video mode: activate the arrow tool for flow connections.
    api.setActiveTool(next === 'video' ? { type: 'arrow' } : { type: 'selection' });
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f7f6f1] xl:flex-row dark:bg-neutral-950">
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white/90 px-3 text-sm font-semibold shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-neutral-900/90"
            onClick={() => router.push('/workbench/image')}
          >
            <ArrowLeft className="size-4" />
            {t('actions.backToImage')}
          </button>
          <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-black/10 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-neutral-900/90">
            <ModeButton active={mode === 'image'} icon={<ImageIcon className="size-4" />} label={t('mode.image')} onClick={() => toggleMode('image')} />
            <ModeButton active={mode === 'video'} icon={<GitBranch className="size-4" />} label={t('mode.video')} onClick={() => toggleMode('video')} />
          </div>
          <span className="text-xs text-neutral-500">{saveLabel(saveStatus, t)}</span>
        </div>

        <div className="h-full w-full">
          {ready && initialData ? (
            <Excalidraw
              excalidrawAPI={(api) => {
                apiRef.current = api;
              }}
              initialData={{ elements: initialData.elements as never, files: initialData.files as never }}
              onChange={onExcalidrawChange}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-400">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
        </div>
      </main>

      <aside className="flex max-h-[45svh] w-full shrink-0 flex-col border-t border-black/10 bg-white xl:h-full xl:max-h-none xl:w-[420px] xl:border-l xl:border-t-0 dark:border-white/10 dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
          <div>
            <h1 className="text-base font-bold">{t('title')}</h1>
            <p className="text-xs text-neutral-500">{mode === 'image' ? t('mode.imageHint') : t('mode.videoHint')}</p>
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">{t('model')}</span>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <p className="mt-8 text-center text-sm text-neutral-400">{t('prompt.placeholder')}</p>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
        </div>

        {!canGenerate && (
          <div className="mx-5 mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {entitlementReason ?? t('actions.generateComingSoon')}
          </div>
        )}

        <div className="border-t border-black/10 p-4 dark:border-white/10">
          <div className="flex items-end gap-2">
            <textarea
              className="min-h-11 max-h-40 flex-1 resize-none rounded-lg border border-black/10 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-neutral-900"
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
            />
            <button
              type="button"
              disabled={generating || !input.trim()}
              onClick={() => void submit()}
              className="inline-flex size-11 items-center justify-center rounded-lg bg-neutral-950 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition ${
        active ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950' : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100'
        }`}
      >
        {message.pending ? (
          <span className="inline-flex items-center gap-1.5 text-neutral-500">
            <Sparkles className="size-3.5 animate-pulse" /> …
          </span>
        ) : (
          <>
            {message.text && <p className={message.error ? 'text-red-500' : ''}>{message.text}</p>}
            {message.images && message.images.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {message.images.map((url) => (
                  <img key={url} src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
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

function saveLabel(status: 'idle' | 'saving' | 'saved' | 'conflict', t: (k: string) => string): string {
  if (status === 'saving') return t('status.saving');
  if (status === 'saved') return t('status.saved');
  if (status === 'conflict') return t('status.conflict');
  return '';
}
