'use client';

// Draw is a conversation-bound creative workspace:
// left side is the Excalidraw board, right side is the active conversation.
// The conversation id selects the board; generated/uploaded images are placed
// on the board and their positions persist through the canvas board API.

import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronDown,
  Download,
  Film,
  Frame,
  ImageIcon,
  Layers,
  LayoutGrid,
  Loader2,
  MousePointer2,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Search,
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
  X,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { drawBoardActions, type Conversation, type ConversationMessage, type ModelConfigItem } from '@autix/shared-store';
import { ModelPickerPopover } from '../chat/ModelPickerPopover';
import {
  type DrawElement,
  type PersistedMessage,
  boardStateToScene,
  conversationImageUrls,
  readConversation,
  sceneSignature,
  sceneToBoardState,
} from './draw-scene-mapper';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  { ssr: false },
);

const SAVE_DEBOUNCE_MS = 1200;
const TITLE_SAVE_DEBOUNCE_MS = 900;
const DEFAULT_IMAGE_SIZE = 320;
const DEFAULT_STROKE_COLOR = '#111827';
const DRAW_COLOR_SWATCHES = [
  '#111827',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
];
const GENERIC_CONVERSATION_TITLES = new Set(['新绘制对话', 'New Conversation', 'Untitled', '绘制对话']);

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
.draw-canvas .excalidraw { --color-primary: #ffffff; --color-primary-darker: #d4d4d4; }
`;

export interface DrawWorkspaceProps {
  boardId: string;
  conversationId: string;
  onConversationChange: (conversationId: string) => void;
  modelConfigId?: string;
}

type Tool = 'selection' | 'frame' | 'rectangle' | 'freedraw' | 'text' | 'eraser';
type GenerationMode = 'image' | 'video';
type UploadTarget = 'canvas' | 'composer';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  videos?: string[];
  pending?: boolean;
  error?: boolean;
}

interface ComposerImage {
  id: string;
  url: string;
  name: string;
}

interface CanvasImageRef {
  elementId: string;
  url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionInfo extends CanvasImageRef {
  screenX: number;
  screenY: number;
  zoom: number;
  assetUrl: string | null;
}

interface AppStateLike {
  activeTool?: { type?: string };
  zoom?: { value?: number };
  scrollX?: number;
  scrollY?: number;
  selectedElementIds?: Record<string, boolean>;
}

type Tr = (key: string, values?: Record<string, string | number>) => string;

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tr(t: Tr, key: string, fallback: string, values?: Record<string, string | number>): string {
  try {
    const value = t(key, values);
    return value === key || value.endsWith(`.${key}`) ? fallback : value;
  } catch {
    return fallback;
  }
}

export function DrawWorkspace({
  boardId,
  conversationId,
  onConversationChange,
  modelConfigId,
}: DrawWorkspaceProps) {
  const t = useTranslations('drawWorkspace');

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const revisionRef = useRef(1);
  const lastSavedSigRef = useRef('');
  const lastSavedTitleRef = useRef('');
  const lastExcalidrawChangeSigRef = useRef('');
  const lastSceneChangeSigRef = useRef('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeCountRef = useRef(0);
  const modelIdRef = useRef(modelConfigId ?? '');
  const videoModelIdRef = useRef('');
  const videoProjectIdRef = useRef<string | null>(null);
  const selectedElementIdsRef = useRef<string[]>([]);
  const drawStrokeColorRef = useRef(DEFAULT_STROKE_COLOR);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const uploadTargetRef = useRef<UploadTarget>('canvas');

  const [ready, setReady] = useState(false);
  const [initialData, setInitialData] = useState<{ elements: DrawElement[]; files: Record<string, unknown> } | null>(null);
  const [tool, setTool] = useState<Tool>('selection');
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditInput, setQuickEditInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<CanvasImageRef[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [input, setInput] = useState('');
  const [composerImages, setComposerImages] = useState<ComposerImage[]>([]);
  const composerImagesRef = useRef(composerImages);
  composerImagesRef.current = composerImages;
  const [mode, setMode] = useState<GenerationMode>('image');
  const [title, setTitle] = useState(t('untitled'));
  const [imageModels, setImageModels] = useState<ModelConfigItem[]>([]);
  const [videoModels, setVideoModels] = useState<ModelConfigItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(modelConfigId ?? null);
  const [selectedVideoModelId, setSelectedVideoModelId] = useState<string | null>(null);
  const [drawStrokeColor, setDrawStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [credits, setCredits] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [canGenerate, setCanGenerate] = useState(true);
  const [entitlementReason, setEntitlementReason] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict'>('idle');
  const [showUpsell, setShowUpsell] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [creatingConversation, setCreatingConversation] = useState(false);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId) ?? null,
    [conversationId, conversations],
  );
  const selectedImageModel = useMemo(
    () => imageModels.find((model) => model.id === selectedModelId) ?? null,
    [imageModels, selectedModelId],
  );
  const selectedVideoModel = useMemo(
    () => videoModels.find((model) => model.id === selectedVideoModelId) ?? null,
    [videoModels, selectedVideoModelId],
  );
  // The model picker follows the active mode: video mode lists video models,
  // image mode lists image models, each with its own remembered selection.
  const isVideoMode = mode === 'video';
  const pickerModels = isVideoMode ? videoModels : imageModels;
  const pickerSelectedModel = isVideoMode ? selectedVideoModel : selectedImageModel;
  const pickerSelectedModelId = isVideoMode ? selectedVideoModelId : selectedModelId;

  const refreshConversations = useCallback(async () => {
    const items = await drawBoardActions.listConversations();
    setConversations(items);
    return items;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setInitialData(null);
    setSelection(null);
    setSelectedImages([]);
    selectedElementIdsRef.current = [];
    setComposerImages([]);
    placeCountRef.current = 0;
    videoProjectIdRef.current = null;

    (async () => {
      try {
        const [data, conversationMessages, conversationItems] = await Promise.all([
          drawBoardActions.getState(boardId),
          drawBoardActions.getConversationMessages(conversationId).catch(() => []),
          drawBoardActions.listConversations().catch(() => []),
        ]);
        if (cancelled) return;

        revisionRef.current = data.board.revision;
        setCanGenerate(data.entitlement.canGenerate);
        setEntitlementReason(data.entitlement.reason ?? null);
        setConversations(conversationItems);

        const conversationTitle =
          conversationItems.find((item) => item.id === conversationId)?.title ||
          data.board.title ||
          t('untitled');
        setTitle(conversationTitle);
        lastSavedTitleRef.current = conversationTitle;

        const scene = boardStateToScene(data.state);
        const restoredFromConversation = conversationMessages.map(conversationMessageToChatMessage);
        const restoredFromBoard = readConversation(data.state).map((m) => ({ ...m }));
        const restored = restoredFromConversation.length > 0 ? restoredFromConversation : restoredFromBoard;

        setMessages(restored);
        lastSavedSigRef.current = combinedSignature(scene.elements, toPersistedMessages(restored));
        lastSceneChangeSigRef.current = sceneSignature(scene.elements);
        lastExcalidrawChangeSigRef.current = '';
        setInitialData({ elements: scene.elements, files: scene.files });
      } catch {
        if (!cancelled) {
          setInitialData({ elements: [], files: {} });
          setMessages([]);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    };
  }, [boardId, conversationId, t]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    (async () => {
      try {
        const [models, videos, balance] = await Promise.all([
          drawBoardActions.listImageModels(),
          drawBoardActions.listVideoModels(),
          drawBoardActions.getCredits().catch(() => null),
        ]);
        if (cancelled) return;
        setImageModels(models);
        const selected = modelIdRef.current
          ? models.find((model) => model.id === modelIdRef.current)
          : null;
        const chosen = selected ?? models.find((model) => model.isDefault) ?? models[0] ?? null;
        modelIdRef.current = chosen?.id ?? '';
        setSelectedModelId(chosen?.id ?? null);

        setVideoModels(videos);
        const chosenVideo = videos.find((model) => model.isDefault) ?? videos[0] ?? null;
        videoModelIdRef.current = chosenVideo?.id ?? '';
        setSelectedVideoModelId(chosenVideo?.id ?? null);

        if (balance !== null) setCredits(balance);
      } catch {
        // Non-fatal; the send action will surface a concrete error if no model exists.
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;

    const elements = api.getSceneElements() as unknown as DrawElement[];
    const conversation = toPersistedMessages(messagesRef.current);
    const sig = combinedSignature(elements, conversation);
    if (sig === lastSavedSigRef.current) return;

    setSaveStatus('saving');
    const state = sceneToBoardState(elements, revisionRef.current, new Date().toISOString(), conversation);

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
        lastSavedSigRef.current = combinedSignature(scene.elements, toPersistedMessages(messagesRef.current));
        lastSceneChangeSigRef.current = sceneSignature(scene.elements);
        lastExcalidrawChangeSigRef.current = '';
        api.updateScene({ elements: scene.elements as never });
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

  useEffect(() => {
    if (ready) scheduleSave();
  }, [messages, ready, scheduleSave]);

  const saveTitle = useCallback(async (nextTitle: string) => {
    const normalized = nextTitle.trim();
    if (!normalized || normalized === lastSavedTitleRef.current) return;
    lastSavedTitleRef.current = normalized;
    try {
      await Promise.all([
        drawBoardActions.updateBoard(boardId, { title: normalized }),
        drawBoardActions.updateConversationTitle(conversationId, normalized),
      ]);
      setConversations((items) => items.map((item) => (
        item.id === conversationId ? { ...item, title: normalized } : item
      )));
    } catch {
      toast.error(t('chat.renameFailed'));
    }
  }, [boardId, conversationId, t]);

  useEffect(() => {
    if (!ready) return;
    if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    titleSaveTimerRef.current = setTimeout(() => void saveTitle(title), TITLE_SAVE_DEBOUNCE_MS);
    return () => {
      if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    };
  }, [ready, saveTitle, title]);

  const setConversationTitleFromPrompt = useCallback(async (prompt: string) => {
    const currentTitle = title.trim();
    if (messagesRef.current.some((message) => message.role === 'user')) return;
    if (currentTitle && currentTitle !== t('untitled') && !GENERIC_CONVERSATION_TITLES.has(currentTitle)) return;
    const nextTitle = prompt.slice(0, 60);
    setTitle(nextTitle);
    await saveTitle(nextTitle);
  }, [saveTitle, t, title]);

  const placeImage = useCallback(async (
    url: string,
    label: string,
    position?: { x: number; y: number },
  ): Promise<DrawElement | null> => {
    const api = apiRef.current;
    if (!api) return null;

    const mod = await import('@excalidraw/excalidraw');
    const fileId = newId('file');
    const dataURL = await toExcalidrawDataUrl(url);
    api.addFiles([{ id: fileId as never, dataURL: dataURL as never, mimeType: 'image/png' as never, created: Date.now() }]);

    // Size the element to the image's real aspect ratio (longest side =
    // DEFAULT_IMAGE_SIZE) so non-square images are never stretched.
    const { width, height } = fitWithinBox(await measureImage(dataURL), DEFAULT_IMAGE_SIZE);

    const n = placeCountRef.current++;
    const skeleton = mod
      .convertToExcalidrawElements([
        {
          type: 'image',
          fileId: fileId as never,
          x: position?.x ?? 80 + (n % 4) * (DEFAULT_IMAGE_SIZE + 28),
          y: position?.y ?? 80 + Math.floor(n / 4) * (DEFAULT_IMAGE_SIZE + 28),
          width,
          height,
        },
      ])
      .map((el) => ({ ...el, customData: { assetUrl: url, label } })) as unknown as DrawElement[];

    const current = api.getSceneElements();
    api.updateScene({
      elements: [...current, ...skeleton] as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    api.scrollToContent(skeleton as never, { animate: true });
    scheduleSave();
    return skeleton[0] ?? null;
  }, [scheduleSave]);

  const locateOrPlace = useCallback(async (url: string, label: string) => {
    const api = apiRef.current;
    if (!api) return;
    const existing = (api.getSceneElements() as unknown as DrawElement[]).find(
      (e) => e.type === 'image' && e.customData?.assetUrl === url && !e.isDeleted,
    );
    if (existing) {
      api.updateScene({ appState: { selectedElementIds: { [existing.id]: true } } } as never);
      api.scrollToContent([existing as never], { animate: true });
    } else {
      await placeImage(url, label);
    }
  }, [placeImage]);

  // Place conversation image artifacts that aren't already on the canvas.
  // `respectDeleted` includes deleted tombstones in the "already present" set
  // so user-removed images are not resurrected — used by the auto-reconcile on
  // load. The manual "tile all" button re-adds everything the user can't see.
  const tileHistoryToCanvas = useCallback(async (respectDeleted = false) => {
    const api = apiRef.current;
    if (!api) return;
    const known = respectDeleted
      ? (api.getSceneElementsIncludingDeleted() as unknown as DrawElement[])
      : (api.getSceneElements() as unknown as DrawElement[]).filter((e) => !e.isDeleted);
    const onCanvas = new Set(
      known
        .filter((e) => e.type === 'image')
        .map((e) => String(e.customData?.assetUrl ?? '')),
    );
    for (const url of conversationImageUrls(toPersistedMessages(messagesRef.current))) {
      if (!onCanvas.has(url)) await placeImage(url, '');
    }
  }, [placeImage]);

  // On load, once the board scene and the Excalidraw API are ready, reconcile
  // the conversation's image artifacts onto the canvas so every generated image
  // is visible without the user having to press "tile all".
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 40 && !apiRef.current && !cancelled; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (cancelled || !apiRef.current) return;
      await tileHistoryToCanvas(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, boardId, conversationId, tileHistoryToCanvas]);

  const createVideoFlow = useCallback(async (prompt: string, attachmentImages: ComposerImage[]) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');

    const placedAttachments: CanvasImageRef[] = [];
    for (let i = 0; i < attachmentImages.length; i += 1) {
      const placed = await placeImage(attachmentImages[i].url, attachmentImages[i].name, {
        x: 80,
        y: 80 + i * (DEFAULT_IMAGE_SIZE + 28),
      });
      if (placed) placedAttachments.push(drawElementToImageRef(placed, attachmentImages[i].name));
    }

    const imageRefs = [...selectedImages, ...placedAttachments]
      .filter((item, index, arr) => arr.findIndex((next) => next.url === item.url) === index)
      .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

    const sourceRight = imageRefs.length > 0
      ? Math.max(...imageRefs.map((item) => item.x + item.width))
      : 80;
    const sourceTop = imageRefs.length > 0
      ? Math.min(...imageRefs.map((item) => item.y))
      : 80;

    const promptBoxId = newId('flow-prompt');
    const promptTextId = newId('flow-text');
    const outputBoxId = newId('flow-video');
    const outputTextId = newId('flow-video-text');
    const promptX = sourceRight + 90;
    const promptY = sourceTop;
    const outputX = promptX + 430;
    const outputY = promptY + 8;

    const skeleton: Array<Record<string, unknown>> = [
      {
        id: promptBoxId,
        type: 'rectangle',
        x: promptX,
        y: promptY,
        width: 340,
        height: 148,
        backgroundColor: '#fff7ed',
        strokeColor: '#f97316',
        fillStyle: 'solid',
        roundness: { type: 3 },
        customData: { kind: 'videoPrompt', prompt },
      },
      {
        id: promptTextId,
        type: 'text',
        x: promptX + 18,
        y: promptY + 18,
        width: 304,
        fontSize: 20,
        text: `${t('flow.prompt')}\n${prompt}`,
        customData: { kind: 'videoPromptText', prompt },
      },
      {
        id: outputBoxId,
        type: 'rectangle',
        x: outputX,
        y: outputY,
        width: 340,
        height: 190,
        backgroundColor: '#111827',
        strokeColor: '#111827',
        fillStyle: 'solid',
        roundness: { type: 3 },
        customData: { kind: 'videoOutputPlaceholder', prompt },
      },
      {
        id: outputTextId,
        type: 'text',
        x: outputX + 24,
        y: outputY + 58,
        width: 292,
        fontSize: 22,
        strokeColor: '#ffffff',
        text: `${t('flow.videoOutput')}\n${t('flow.waitingForRender')}`,
        customData: { kind: 'videoOutputText' },
      },
      {
        id: newId('flow-arrow'),
        type: 'arrow',
        x: promptX + 352,
        y: promptY + 72,
        points: [[0, 0], [66, 20]],
        endArrowhead: 'arrow',
        strokeColor: '#111827',
        customData: { kind: 'flowEdge', from: promptBoxId, to: outputBoxId },
      },
    ];

    for (const ref of imageRefs) {
      skeleton.push({
        id: newId('flow-source-arrow'),
        type: 'arrow',
        x: ref.x + ref.width + 14,
        y: ref.y + ref.height / 2,
        points: [[0, 0], [Math.max(48, promptX - (ref.x + ref.width) - 30), promptY + 74 - (ref.y + ref.height / 2)]],
        endArrowhead: 'arrow',
        strokeColor: '#2563eb',
        customData: { kind: 'flowEdge', from: ref.elementId, to: promptBoxId },
      });
    }

    const elements = mod.convertToExcalidrawElements(skeleton as never, { regenerateIds: false });
    api.updateScene({
      elements: [...api.getSceneElements(), ...elements] as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    api.scrollToContent(elements, { animate: true });
    api.setActiveTool({ type: 'arrow' } as never);
    scheduleSave();
  }, [placeImage, scheduleSave, selectedImages, t]);

  // `quick` drives the inline quick-edit box anchored under a canvas image:
  // it forces image mode, sources the prompt/reference from the box, and leaves
  // the main composer untouched. Without it this is the normal composer submit.
  const submit = useCallback(async (quick?: { prompt: string; referenceUrls: string[] }) => {
    const prompt = (quick?.prompt ?? input).trim();
    if (!prompt || generating) return;
    const isVideo = !quick && mode === 'video';

    const attachmentImages = quick ? [] : composerImagesRef.current;
    const selectedReferenceUrls = quick ? quick.referenceUrls : selectedImages.map((item) => item.url).filter(Boolean);
    const attachmentUrls = attachmentImages.map((item) => item.url);
    const referenceImageUrls = uniqueStrings([...selectedReferenceUrls, ...attachmentUrls]);
    const pendingId = newId('m');
    const userMessage: ChatMessage = { id: newId('m'), role: 'user', text: prompt, images: attachmentUrls };

    setMessages((m) => [
      ...m,
      userMessage,
      { id: pendingId, role: 'assistant', text: '', pending: true },
    ]);
    if (!quick) {
      setInput('');
      setComposerImages([]);
    }
    setGenerating(true);

    try {
      await setConversationTitleFromPrompt(prompt);
      void drawBoardActions.appendConversationMessage(conversationId, {
        role: 'USER',
        content: prompt,
        metadata: {
          messageType: isVideo ? 'draw_video_prompt' : 'draw_image_prompt',
          images: referenceImageUrls,
        },
      }).catch(() => undefined);

      if (isVideo) {
        if (!videoModelIdRef.current) {
          throw new Error(t('chat.noVideoModel'));
        }

        // Draw the flow diagram for visual context, then run a real generation.
        await createVideoFlow(prompt, attachmentImages);

        const started = await drawBoardActions.startVideoGeneration({
          projectId: videoProjectIdRef.current ?? undefined,
          title: title || t('untitled'),
          prompt,
          modelConfigId: videoModelIdRef.current,
          referenceImageUrls,
        });
        videoProjectIdRef.current = started.projectId;

        const result = await drawBoardActions.pollVideoGeneration(started.projectId, started.generationId);
        if (result.status !== 'completed' || !result.videoUrl) {
          throw new Error(result.error || t('chat.videoFailed'));
        }

        const videoUrl = result.videoUrl;
        // Excalidraw can't play video, so drop a poster frame on the canvas (if
        // any) and surface the playable clip in the chat panel.
        if (result.thumbnailUrl) {
          await placeImage(result.thumbnailUrl, prompt).catch(() => undefined);
        }
        const text = `${t('chat.done')}：${prompt}`;
        setMessages((m) => m.map((msg) => (
          msg.id === pendingId ? { ...msg, pending: false, text, videos: [videoUrl] } : msg
        )));
        void drawBoardActions.appendConversationMessage(conversationId, {
          role: 'ASSISTANT',
          content: text,
          metadata: {
            messageType: 'draw_video_result',
            videos: [videoUrl],
            thumbnailUrl: result.thumbnailUrl ?? undefined,
          },
        }).catch(() => undefined);
        return;
      }

      if (!canGenerate) {
        throw new Error(entitlementReason ?? t('actions.generateComingSoon'));
      }
      if (!modelIdRef.current) {
        throw new Error(t('chat.noModel'));
      }

      for (let i = 0; i < attachmentImages.length; i += 1) {
        await placeImage(attachmentImages[i].url, attachmentImages[i].name);
      }

      const gen = await drawBoardActions.chatGenerate(boardId, {
        idempotencyKey: newId('idem'),
        prompt,
        modelConfigId: modelIdRef.current,
        referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      });
      const urls = gen.images.map((img) => img.url);
      for (const url of urls) await placeImage(url, prompt);

      const text = `${t('chat.done')}：${prompt}`;
      setMessages((m) => m.map((msg) => (
        msg.id === pendingId ? { ...msg, pending: false, text, images: urls } : msg
      )));
      void drawBoardActions.appendConversationMessage(conversationId, {
        role: 'ASSISTANT',
        content: text,
        metadata: {
          messageType: 'image_result',
          images: gen.images,
        },
      }).catch(() => undefined);
    } catch (error) {
      const text = errorMessage(error, t);
      setMessages((m) => m.map((msg) => (
        msg.id === pendingId ? { ...msg, pending: false, error: true, text } : msg
      )));
      void drawBoardActions.appendConversationMessage(conversationId, {
        role: 'ASSISTANT',
        content: text,
        metadata: { messageType: 'error' },
      }).catch(() => undefined);
    } finally {
      setGenerating(false);
      void refreshConversations().catch(() => undefined);
    }
  }, [
    boardId,
    canGenerate,
    conversationId,
    createVideoFlow,
    entitlementReason,
    generating,
    input,
    mode,
    placeImage,
    refreshConversations,
    selectedImages,
    setConversationTitleFromPrompt,
    title,
    t,
  ]);

  const submitQuickEdit = useCallback(async () => {
    const prompt = quickEditInput.trim();
    if (!prompt || generating || !selection?.assetUrl) return;
    const referenceUrl = selection.assetUrl;
    setQuickEditInput('');
    await submit({ prompt, referenceUrls: [referenceUrl] });
    setQuickEditOpen(false);
  }, [quickEditInput, generating, selection, submit]);

  // Close the inline quick-edit box whenever the selected element changes
  // (or is deselected) so it never lingers over the wrong image.
  useEffect(() => {
    setQuickEditOpen(false);
    setQuickEditInput('');
  }, [selection?.elementId]);

  const onChange = useCallback((elements: readonly unknown[], appState: AppStateLike) => {
    const drawElements = elements as DrawElement[];
    const zoomValue = appState.zoom?.value ?? 1;
    const selectedIds = Object.keys(appState.selectedElementIds ?? {}).filter((id) => appState.selectedElementIds?.[id]);
    const currentTool = normalizeTool(appState.activeTool?.type);
    const sceneSig = sceneSignature(drawElements);
    const changeSig = [
      sceneSig,
      currentTool,
      Math.round(zoomValue * 1000) / 1000,
      Math.round((appState.scrollX ?? 0) * 100) / 100,
      Math.round((appState.scrollY ?? 0) * 100) / 100,
      selectedIds.join(','),
    ].join('::');
    if (changeSig === lastExcalidrawChangeSigRef.current) return;
    lastExcalidrawChangeSigRef.current = changeSig;

    setTool(currentTool);
    setZoom(zoomValue);
    selectedElementIdsRef.current = selectedIds;

    const selectedStrokeColor = selectedIds
      .map((id) => drawElements.find((e) => e.id === id && !e.isDeleted))
      .map((el) => el?.strokeColor)
      .find((color): color is string => typeof color === 'string' && color.length > 0);
    if (selectedStrokeColor && selectedStrokeColor !== drawStrokeColorRef.current) {
      drawStrokeColorRef.current = selectedStrokeColor;
      setDrawStrokeColor(selectedStrokeColor);
    }

    const imageRefs = selectedIds
      .map((id) => drawElements.find((e) => e.id === id && e.type === 'image' && !e.isDeleted))
      .filter(Boolean)
      .map((el) => drawElementToImageRef(el as DrawElement, t('title')));
    setSelectedImages(imageRefs);

    if (imageRefs.length === 1) {
      const el = imageRefs[0];
      const zoomV = appState.zoom?.value ?? 1;
      setSelection({
        ...el,
        screenX: (el.x + (appState.scrollX ?? 0)) * zoomV,
        screenY: (el.y + (appState.scrollY ?? 0)) * zoomV,
        zoom: zoomV,
        assetUrl: el.url,
      });
    } else {
      setSelection(null);
    }

    if (sceneSig !== lastSceneChangeSigRef.current) {
      lastSceneChangeSigRef.current = sceneSig;
      scheduleSave();
    }
  }, [scheduleSave, t]);

  const excalidrawInitialData = useMemo(() => (
    initialData
      ? {
          elements: initialData.elements as never,
          files: initialData.files as never,
          appState: {
            currentItemStrokeColor: DEFAULT_STROKE_COLOR,
            viewBackgroundColor: '#f3f4f6',
          } as never,
        }
      : undefined
  ), [initialData]);
  const excalidrawUIOptions = useMemo(() => ({ canvasActions: { export: false as const } }), []);
  const handleExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
  }, []);

  const setActiveTool = useCallback((next: Tool) => {
    apiRef.current?.setActiveTool({ type: next } as never);
    setTool(next);
  }, []);

  const applyStrokeColor = useCallback(async (color: string) => {
    drawStrokeColorRef.current = color;
    setDrawStrokeColor(color);

    const api = apiRef.current;
    if (!api) return;

    const mod = await import('@excalidraw/excalidraw');
    const selectedIds = new Set(selectedElementIdsRef.current);
    const hasSelection = selectedIds.size > 0;
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const nextElements = hasSelection
      ? elements.map((element) => (
          selectedIds.has(element.id) && isColorableElement(element)
            ? { ...element, strokeColor: color }
            : element
        ))
      : elements;

    api.updateScene({
      elements: nextElements as never,
      appState: { currentItemStrokeColor: color } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });

    if (hasSelection) scheduleSave();
  }, [scheduleSave]);

  const startFlowConnection = useCallback(() => {
    setMode('video');
    apiRef.current?.setActiveTool({ type: 'arrow' } as never);
    composerRef.current?.focus();
  }, []);

  const addComposerFiles = useCallback(async (files: File[]) => {
    const images: ComposerImage[] = [];
    for (const file of files.slice(0, 8)) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('toast.unsupportedFile'));
        continue;
      }
      images.push({ id: newId('upload'), url: await readFileAsDataUrl(file), name: file.name });
    }
    if (images.length > 0) {
      setComposerImages((current) => [...current, ...images].slice(0, 8));
      composerRef.current?.focus();
    }
  }, [t]);

  const onUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    if (uploadTargetRef.current === 'composer') {
      await addComposerFiles(list);
    } else {
      for (const file of list.slice(0, 8)) {
        if (!file.type.startsWith('image/')) {
          toast.error(t('toast.unsupportedFile'));
          continue;
        }
        await placeImage(await readFileAsDataUrl(file), file.name);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addComposerFiles, placeImage, t]);

  const openUpload = useCallback((target: UploadTarget) => {
    uploadTargetRef.current = target;
    fileInputRef.current?.click();
  }, []);

  const handleComposerPaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    void addComposerFiles(files);
  }, [addComposerFiles]);

  const handleCanvasDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    uploadTargetRef.current = 'canvas';
    void onUpload(event.dataTransfer.files);
  }, [onUpload]);

  const useSelectedForPrompt = useCallback((preset: string) => {
    if (!selection) return;
    setMode('image');
    setInput(preset);
    composerRef.current?.focus();
  }, [selection]);

  const downloadSelected = useCallback(() => {
    if (!selection?.assetUrl) return;
    downloadUrl(selection.assetUrl, `${selection.label || 'draw-image'}.png`);
  }, [selection]);

  // Resize the selected image to its natural aspect ratio, keeping the current
  // longest side and the top-left corner anchored, so a stretched image snaps
  // back to the right proportions.
  const fitSelectedToRatio = useCallback(async () => {
    const api = apiRef.current;
    if (!api || !selection?.assetUrl) return;
    const natural = await measureImage(selection.assetUrl);
    if (!(natural.width > 0) || !(natural.height > 0)) return;

    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const target = elements.find((e) => e.id === selection.elementId && !e.isDeleted);
    if (!target) return;

    const maxSide = Math.max(
      Number(target.width) || DEFAULT_IMAGE_SIZE,
      Number(target.height) || DEFAULT_IMAGE_SIZE,
    );
    const fitted = fitWithinBox(natural, maxSide);
    if (fitted.width === Math.round(Number(target.width)) && fitted.height === Math.round(Number(target.height))) {
      return;
    }

    const next = elements.map((e) => (
      e.id === selection.elementId ? { ...e, width: fitted.width, height: fitted.height } : e
    ));
    api.updateScene({
      elements: next as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    scheduleSave();
  }, [selection, scheduleSave]);

  const shareCurrentConversation = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('chat.linkCopied'));
    } catch {
      toast.error(t('chat.copyFailed'));
    }
  }, [t]);

  const createConversation = useCallback(async () => {
    if (creatingConversation) return;
    setCreatingConversation(true);
    try {
      const conversation = await drawBoardActions.createConversation();
      setConversationMenuOpen(false);
      onConversationChange(conversation.id);
    } catch {
      toast.error(t('chat.createFailed'));
    } finally {
      setCreatingConversation(false);
    }
  }, [creatingConversation, onConversationChange, t]);

  const filteredConversations = useMemo(() => {
    const keyword = conversationSearch.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter((item) => (item.title || '').toLowerCase().includes(keyword));
  }, [conversationSearch, conversations]);

  const activeTitle = title.trim() || activeConversation?.title || t('untitled');
  const canSend = Boolean(input.trim()) && !generating;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-black text-white">
      <style>{HIDE_EXCALIDRAW_UI}</style>

      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-black/90 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-black">
            <Wand2 className="size-4" />
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 max-w-[42vw] rounded-md bg-transparent px-1 text-sm font-semibold text-white outline-none placeholder:text-white/35 hover:bg-white/10 focus:bg-white/10 md:w-[360px]"
          />
          <span className="hidden text-xs text-white/45 sm:inline">{saveLabel(saveStatus, t)}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white sm:flex">
            <Zap className="size-3.5 text-amber-500" />
            {credits ?? '-'}
          </div>
          <IconBtn
            title={panelOpen ? t('chat.collapse') : t('chat.expand')}
            onClick={() => {
              setConversationMenuOpen(false);
              setPanelOpen((value) => !value);
            }}
          >
            {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </IconBtn>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <main
          className="draw-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black"
          onDragOver={(event) => {
            if (Array.from(event.dataTransfer.items).some((item) => item.kind === 'file')) event.preventDefault();
          }}
          onDrop={handleCanvasDrop}
        >
          {ready && initialData ? (
            <Excalidraw
              excalidrawAPI={handleExcalidrawAPI}
              initialData={excalidrawInitialData}
              onChange={onChange as never}
              UIOptions={excalidrawUIOptions}
              theme="dark"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-white/45">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}

          {selection && (
            <ContextualToolbar
              t={t}
              info={selection}
              onQuickEdit={() => setQuickEditOpen(true)}
              onUpscale={() => useSelectedForPrompt(t('context.upscalePrompt'))}
              onRemoveBg={() => useSelectedForPrompt(t('context.removeBgPrompt'))}
              onEraser={() => setActiveTool('eraser')}
              onFitSize={() => void fitSelectedToRatio()}
              onDownload={downloadSelected}
            />
          )}

          {selection && quickEditOpen && (
            <QuickEditBox
              t={t}
              info={selection}
              value={quickEditInput}
              generating={generating}
              onChange={setQuickEditInput}
              onSubmit={() => void submitQuickEdit()}
              onClose={() => setQuickEditOpen(false)}
            />
          )}

          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-lg border border-white/12 bg-black/[0.88] px-2 py-1 text-xs text-white/80 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur">
            <Layers className="size-4 text-white/50" />
            <span className="tabular-nums font-medium">{Math.round(zoom * 100)}%</span>
          </div>

          <BottomDock
            t={t}
            tool={tool}
            mode={mode}
            strokeColor={drawStrokeColor}
            onSelect={() => setActiveTool('selection')}
            onFrame={() => setActiveTool('frame')}
            onUpload={() => openUpload('canvas')}
            onRectangle={() => setActiveTool('rectangle')}
            onPen={() => setActiveTool('freedraw')}
            onText={() => setActiveTool('text')}
            onGenImage={() => {
              setMode('image');
              composerRef.current?.focus();
            }}
            onGenVideo={startFlowConnection}
            onStrokeColorChange={(color) => void applyStrokeColor(color)}
          />
        </main>

        {panelOpen && (
          <aside className="flex max-h-[45svh] w-full shrink-0 flex-col border-t border-white/10 bg-black text-white xl:h-full xl:max-h-none xl:w-[420px] xl:border-l xl:border-t-0">
            <div className="relative z-30 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{firstUserPrompt(messages) ?? activeTitle}</h1>
                <ConversationMenu
                  t={t}
                  open={conversationMenuOpen}
                  activeConversationId={conversationId}
                  conversations={filteredConversations}
                  search={conversationSearch}
                  loading={creatingConversation}
                  onSearch={setConversationSearch}
                  onToggle={() => {
                    setConversationMenuOpen((value) => !value);
                    void refreshConversations().catch(() => undefined);
                  }}
                  onCreate={() => void createConversation()}
                  onSelect={(id) => {
                    setConversationMenuOpen(false);
                    onConversationChange(id);
                  }}
                />
                <IconBtn title={t('chat.share')} onClick={() => void shareCurrentConversation()}><Share2 className="size-4" /></IconBtn>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <DrawModelPicker
                  t={t}
                  models={pickerModels}
                  selectedModel={pickerSelectedModel}
                  selectedModelId={pickerSelectedModelId}
                  loading={modelsLoading}
                  onChange={(id) => {
                    if (isVideoMode) {
                      videoModelIdRef.current = id ?? '';
                      setSelectedVideoModelId(id);
                    } else {
                      modelIdRef.current = id ?? '';
                      setSelectedModelId(id);
                    }
                  }}
                />
                <IconBtn title={t('chat.tileAll')} onClick={() => void tileHistoryToCanvas()}><LayoutGrid className="size-4" /></IconBtn>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-black px-5 py-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white/45">
                {mode === 'video' ? <Film className="size-3.5" /> : <Sparkles className="size-3.5" />}
                {mode === 'video' ? t('mode.videoHint') : t('mode.imageHint')}
              </div>
              {messages.length === 0 ? (
                <p className="mt-10 text-center text-sm text-white/45">{t('chat.empty')}</p>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} t={t} onImageClick={(url) => void locateOrPlace(url, msg.text)} />
                ))
              )}
            </div>

            {!canGenerate && mode === 'image' && showUpsell && (
              <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-xs text-amber-100">
                <Sparkles className="size-4 shrink-0" />
                <span className="flex-1">{entitlementReason ?? t('actions.generateComingSoon')}</span>
                <button type="button" onClick={() => setShowUpsell(false)} className="text-amber-500"><X className="size-3.5" /></button>
              </div>
            )}

            <div className="border-t border-white/10 bg-black p-4">
              {(selectedImages.length > 0 || composerImages.length > 0) && (
                <ReferenceStrip
                  t={t}
                  selectedImages={selectedImages}
                  composerImages={composerImages}
                  onRemoveComposer={(id) => setComposerImages((items) => items.filter((item) => item.id !== id))}
                />
              )}
              <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-white/24 focus-within:ring-[3px] focus-within:ring-white/[0.08]">
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handleComposerPaste}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  placeholder={mode === 'video' ? t('prompt.videoPlaceholder') : t('prompt.placeholder')}
                  rows={1}
                  className="max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/35"
                />
                <div className="flex items-center gap-1 px-1">
                  <IconBtn title={t('chat.attach')} onClick={() => openUpload('composer')}><Plus className="size-4" /></IconBtn>
                  <IconBtn title={t('chat.attachToCanvas')} onClick={() => openUpload('canvas')}><Upload className="size-4" /></IconBtn>
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() => void submit()}
                    className="ml-auto inline-flex size-8 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:opacity-40"
                  >
                    {generating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onUpload(e.target.files)} />
    </div>
  );
}

function ConversationMenu(props: {
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

function DrawModelPicker(props: {
  t: Tr;
  models: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  loading: boolean;
  onChange: (id: string | null) => void;
}) {
  const label = props.loading
    ? tr(props.t, 'chat.modelLoading', '加载模型…')
    : props.selectedModel?.name ?? tr(props.t, 'chat.modelEmpty', '暂无模型');
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
          className="inline-flex h-8 min-w-0 max-w-[260px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.08] px-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-white/50" />
        </button>
      )}
    />
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className="grid size-8 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white">
      {children}
    </button>
  );
}

function DockBtn({ title, active, dot, onClick, children }: { title: string; active?: boolean; dot?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`relative grid size-10 place-items-center rounded-lg transition ${active ? 'bg-white text-black' : 'text-white/68 hover:bg-white/10 hover:text-white'}`}
    >
      {children}
      {dot && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />}
    </button>
  );
}

function BottomDock(props: {
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
  onStrokeColorChange: (color: string) => void;
}) {
  const { t, tool } = props;
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
      <DockBtn title={t('dock.genVideo')} active={props.mode === 'video'} onClick={props.onGenVideo}><Video className="size-5" /></DockBtn>
    </div>
  );
}

function ContextualToolbar(props: {
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

function QuickEditBox(props: {
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

function ReferenceStrip(props: {
  t: Tr;
  selectedImages: CanvasImageRef[];
  composerImages: ComposerImage[];
  onRemoveComposer: (id: string) => void;
}) {
  const count = props.selectedImages.length + props.composerImages.length;
  return (
    <div className="mb-2 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/50">
        <ImageIcon className="size-3.5" /> {props.t('chat.referenceImages', { count })}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {props.selectedImages.map((image) => (
          <div key={image.elementId} className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-white/35">
            <img src={image.url} alt="" className="size-full object-cover" />
          </div>
        ))}
        {props.composerImages.map((image) => (
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

function MessageBubble({ message, t, onImageClick }: { message: ChatMessage; t: Tr; onImageClick?: (url: string) => void }) {
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

function firstUserPrompt(messages: ChatMessage[]): string | null {
  return messages.find((m) => m.role === 'user')?.text ?? null;
}

function toPersistedMessages(messages: ChatMessage[]): PersistedMessage[] {
  return messages
    .filter((m) => !m.pending)
    .map((m) => ({ id: m.id, role: m.role, text: m.text, images: m.images, videos: m.videos }));
}

function combinedSignature(elements: readonly DrawElement[], conversation: readonly PersistedMessage[]): string {
  const conv = JSON.stringify(conversation.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    images: m.images ?? [],
    videos: m.videos ?? [],
  })));
  return `${sceneSignature(elements)}##${conv}`;
}

function conversationMessageToChatMessage(message: ConversationMessage): ChatMessage {
  const metadata = asRecord(message.metadata);
  const images = extractImagesFromMetadata(metadata);
  const videos = extractUrlsFromMetadata(metadata, 'videos');
  return {
    id: message.id,
    role: message.role === 'USER' ? 'user' : 'assistant',
    text: message.content,
    images: images.length > 0 ? images : undefined,
    videos: videos.length > 0 ? videos : undefined,
    error: metadata?.messageType === 'error',
  };
}

function extractImagesFromMetadata(metadata: Record<string, unknown> | null): string[] {
  return extractUrlsFromMetadata(metadata, 'images');
}

function extractUrlsFromMetadata(metadata: Record<string, unknown> | null, key: string): string[] {
  if (!metadata) return [];
  const raw = metadata[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).url === 'string') {
        return (item as Record<string, string>).url;
      }
      return null;
    })
    .filter((url): url is string => Boolean(url));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizeTool(tool: string | undefined): Tool {
  if (tool === 'frame' || tool === 'rectangle' || tool === 'freedraw' || tool === 'text' || tool === 'eraser') return tool;
  return 'selection';
}

function isColorableElement(element: DrawElement): boolean {
  return (
    element.type === 'text' ||
    element.type === 'frame' ||
    element.type === 'rectangle' ||
    element.type === 'diamond' ||
    element.type === 'ellipse' ||
    element.type === 'arrow' ||
    element.type === 'line' ||
    element.type === 'freedraw'
  );
}

function drawElementToImageRef(el: DrawElement, fallbackLabel: string): CanvasImageRef {
  const assetUrl = typeof el.customData?.assetUrl === 'string' ? el.customData.assetUrl : '';
  return {
    elementId: el.id,
    url: assetUrl,
    label: typeof el.customData?.label === 'string' && el.customData.label ? el.customData.label : fallbackLabel,
    x: Number(el.x) || 0,
    y: Number(el.y) || 0,
    width: Math.round(Number(el.width) || DEFAULT_IMAGE_SIZE),
    height: Math.round(Number(el.height) || DEFAULT_IMAGE_SIZE),
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('file-read-failed'));
    reader.readAsDataURL(file);
  });
}

async function toExcalidrawDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    return await readFileAsDataUrl(await res.blob());
  } catch {
    return url;
  }
}

/** Read an image's intrinsic pixel dimensions (0×0 if it fails to decode). */
function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

/**
 * Fit an image into a square `max`×`max` box while preserving aspect ratio, so
 * the longest side equals `max` and the image is never distorted. Falls back to
 * a square box when the natural size is unknown.
 */
function fitWithinBox(
  natural: { width: number; height: number },
  max: number,
): { width: number; height: number } {
  const { width, height } = natural;
  if (!(width > 0) || !(height > 0)) return { width: max, height: max };
  const scale = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function isConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 409,
  );
}

function errorMessage(error: unknown, t: Tr): string {
  if (error && typeof error === 'object') {
    const e = error as { msg?: string; message?: string };
    return e.msg ?? e.message ?? t('chat.generateFailed');
  }
  return t('chat.generateFailed');
}

function saveLabel(status: 'idle' | 'saving' | 'saved' | 'conflict', t: Tr): string {
  if (status === 'saving') return t('status.saving');
  if (status === 'saved') return t('status.saved');
  if (status === 'conflict') return t('status.conflict');
  return '';
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noreferrer';
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
