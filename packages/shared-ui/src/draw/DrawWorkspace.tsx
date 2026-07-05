'use client';

// Draw is a conversation-bound creative workspace:
// left side is the Excalidraw board, right side is the active conversation.
// The conversation id selects the board; generated/uploaded images are placed
// on the board and their positions persist through the canvas board API.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
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
  Trash2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { drawBoardActions, uploadFileToStorage, type Conversation, type ConversationMessage, type ModelConfigItem } from '@autix/shared-store';
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
import {
  VIDEO_LINK_KIND,
  VIDEO_NODE_KIND,
  bindingId as bindingElementId,
  readVideoComposition,
  stringArray,
  uniqueStrings,
  type VideoCompositionMode,
  type VideoNodeData,
} from './draw-video-graph';
import { VideoNodeOverlay, type VideoNodeOverlayImage, type VideoNodeOverlayView } from './VideoNodeOverlay';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  { ssr: false },
);

const SAVE_DEBOUNCE_MS = 1200;
const TITLE_SAVE_DEBOUNCE_MS = 900;
const DEFAULT_IMAGE_SIZE = 320;
const DEFAULT_STROKE_COLOR = '#111827';
const VIDEO_NODE_WIDTH = 460;
const VIDEO_NODE_HEIGHT = 300;
// The Excalidraw node element is an invisible 300px anchor, but the rendered
// overlay panel is content-driven and much taller (thumbnails + shot ribbon +
// prompt + model row). Auto-layout must reserve the panel's real footprint or
// tall storyboard panels overlap their neighbours.
const VIDEO_NODE_PANEL_HEIGHT = 540;
const DRAW_UPLOAD_FOLDER = 'amux-studio/draw-uploads';
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
.draw-canvas .excalidraw .popover,
.draw-canvas .excalidraw .context-menu { z-index: 1000 !important; }
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

interface CanvasImageNodeView extends CanvasImageRef {
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
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

type Tr = {
  (key: string, values?: Record<string, string | number>): string;
  has?: (key: string) => boolean;
};

interface VideoLinkEditorInfo {
  id: string;
  screenX: number;
  screenY: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: string;
  role: 'sequence' | 'input';
  prompt: string;
  hasPromptField: boolean;
  order?: number;
  plainLabel?: string;
}

type VideoLinkLabelInfo = VideoLinkEditorInfo;

interface CanvasConnectionTarget {
  id: string;
  kind: 'image' | 'video';
  x: number;
  y: number;
}

interface CanvasConnectionDrag {
  sourceId: string;
  sourceX: number;
  sourceY: number;
  pointerX: number;
  pointerY: number;
  target: CanvasConnectionTarget | null;
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tr(t: Tr, key: string, fallback: string, values?: Record<string, string | number>): string {
  try {
    if (t.has && !t.has(key)) return fallback;
    const value = t(key, values);
    return value === key || value.endsWith(`.${key}`) ? fallback : value;
  } catch {
    return fallback;
  }
}

function stopHandledPasteEvent(event: { preventDefault: () => void; stopPropagation: () => void; nativeEvent?: Event }): void {
  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent?.stopImmediatePropagation();
}

function localizeExcalidrawContextMenu(root: ParentNode, t: Tr): void {
  const items = [
    ['wrapSelectionInFrame', 'contextMenu.wrapSelectionInFrame', '将选区包入画框'],
    ['copyElementLink', 'contextMenu.copyElementLink', '复制对象链接'],
  ] as const;

  for (const [testId, key, fallback] of items) {
    const label = root.querySelector(`.context-menu [data-testid="${testId}"] .context-menu-item__label`);
    if (label instanceof HTMLElement) {
      const text = tr(t, key, fallback);
      if (label.textContent !== text) label.textContent = text;
    }
  }
}

export function DrawWorkspace({
  boardId,
  conversationId,
  onConversationChange,
  modelConfigId,
}: DrawWorkspaceProps) {
  const t = useTranslations('drawWorkspace');
  const locale = useLocale();

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
  const lastAppStateRef = useRef<AppStateLike>({});
  const videoNodeSizeRef = useRef<Map<string, string>>(new Map());
  const resumedVideoGenerationIdsRef = useRef<Set<string>>(new Set());
  const drawStrokeColorRef = useRef(DEFAULT_STROKE_COLOR);
  const canvasRootRef = useRef<HTMLElement | null>(null);
  const canvasImageViewsRef = useRef<CanvasImageNodeView[]>([]);
  const videoNodeViewsRef = useRef<VideoNodeOverlayView[]>([]);
  const connectionDragRef = useRef<CanvasConnectionDrag | null>(null);
  const repairingImageAssetIdsRef = useRef<Set<string>>(new Set());
  const initialCenterKeyRef = useRef('');
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
  const [canvasImageViews, setCanvasImageViews] = useState<CanvasImageNodeView[]>([]);
  const [videoNodeViews, setVideoNodeViews] = useState<VideoNodeOverlayView[]>([]);
  const [videoLinkEditor, setVideoLinkEditor] = useState<VideoLinkEditorInfo | null>(null);
  const [videoLinkLabels, setVideoLinkLabels] = useState<VideoLinkLabelInfo[]>([]);
  const [optimizingVideoLinkId, setOptimizingVideoLinkId] = useState<string | null>(null);
  const [optimizingVideoNodeId, setOptimizingVideoNodeId] = useState<string | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<CanvasConnectionDrag | null>(null);
  const [generatingVideoNodeIds, setGeneratingVideoNodeIds] = useState<Set<string>>(() => new Set());
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

  const selectImageModel = useCallback((id: string | null) => {
    modelIdRef.current = id ?? '';
    setSelectedModelId(id);
  }, []);

  const selectVideoModel = useCallback((id: string | null) => {
    videoModelIdRef.current = id ?? '';
    setSelectedVideoModelId(id);
  }, []);

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
    setCanvasImageViews([]);
    setVideoNodeViews([]);
    setVideoLinkEditor(null);
    setVideoLinkLabels([]);
    setConnectionDrag(null);
    setGeneratingVideoNodeIds(new Set());
    resumedVideoGenerationIdsRef.current = new Set();
    selectedElementIdsRef.current = [];
    lastAppStateRef.current = {};
    canvasImageViewsRef.current = [];
    videoNodeViewsRef.current = [];
    videoNodeSizeRef.current.clear();
    connectionDragRef.current = null;
    setComposerImages([]);
    placeCountRef.current = 0;
    videoProjectIdRef.current = null;
    initialCenterKeyRef.current = '';

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
        const restoredElements = scene.elements.map(normalizeVideoCanvasElement);
        const restoredFromConversation = conversationMessages.map(conversationMessageToChatMessage);
        const restoredFromBoard = readConversation(data.state).map((m) => ({ ...m }));
        const restored = restoredFromConversation.length > 0 ? restoredFromConversation : restoredFromBoard;

        setMessages(restored);
        lastSavedSigRef.current = combinedSignature(scene.elements, toPersistedMessages(restored));
        lastSceneChangeSigRef.current = sceneSignature(scene.elements);
        lastExcalidrawChangeSigRef.current = '';
        setInitialData({ elements: restoredElements, files: scene.files });
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

  const refreshVideoNodeViews = useCallback((elements: readonly DrawElement[], appState: AppStateLike) => {
    const canvasRect = canvasRootRef.current?.getBoundingClientRect();
    const imageViews = buildCanvasImageNodeViews(elements, appState, t('title'));
    const nodeViews = buildVideoNodeViews(elements, appState, t('title'), canvasRect);
    canvasImageViewsRef.current = imageViews;
    videoNodeViewsRef.current = nodeViews;
    setCanvasImageViews(imageViews);
    setVideoNodeViews(nodeViews);
    setVideoLinkLabels(buildVideoLinkLabels(elements, appState, canvasRect));
  }, [t]);

  // Size the (invisible, fixed) Excalidraw node element to match the real
  // rendered panel, so the selection box, connection anchors and layout track
  // what's actually drawn. Screen px → canvas units via the current zoom; the
  // element's screen size then always equals the panel's, at any zoom.
  const syncVideoNodeSize = useCallback((id: string, screenWidth: number, screenHeight: number) => {
    const api = apiRef.current;
    if (!api || screenWidth <= 0 || screenHeight <= 0) return;
    const zoom = lastAppStateRef.current.zoom?.value ?? 1;
    const width = Math.round(screenWidth / zoom);
    const height = Math.round(screenHeight / zoom);
    const key = `${width}x${height}`;
    if (videoNodeSizeRef.current.get(id) === key) return;
    videoNodeSizeRef.current.set(id, key);

    const elements = api.getSceneElements() as unknown as DrawElement[];
    const target = elements.find((element) => (
      element.id === id && !element.isDeleted && element.customData?.kind === VIDEO_NODE_KIND
    ));
    if (!target) return;
    if (Math.abs((Number(target.width) || 0) - width) <= 1 && Math.abs((Number(target.height) || 0) - height) <= 1) {
      return;
    }
    void (async () => {
      const mod = await import('@excalidraw/excalidraw');
      const next = (api.getSceneElements() as unknown as DrawElement[]).map((element) => (
        element.id === id ? { ...element, width, height } : element
      ));
      api.updateScene({ elements: next as never, captureUpdate: mod.CaptureUpdateAction.NEVER as never });
      refreshVideoNodeViews(next, lastAppStateRef.current);
    })();
  }, [refreshVideoNodeViews]);

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
    options?: { reveal?: boolean },
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
    if (options?.reveal !== false) {
      api.scrollToContent(skeleton as never, { animate: true });
    }
    scheduleSave();
    return skeleton[0] ?? null;
  }, [scheduleSave]);

  const uploadCanvasImageFile = useCallback(async (file: File): Promise<string> => {
    try {
      const uploaded = await uploadFileToStorage(file, {
        folder: DRAW_UPLOAD_FOLDER,
        contentType: file.type || 'image/png',
      });
      if (uploaded.publicUrl) return uploaded.publicUrl;
    } catch {
      // Keep canvas paste/upload usable when object storage is unavailable.
    }
    return readFileAsDataUrl(file);
  }, []);

  const addCanvasText = useCallback(async (text: string, position?: { x: number; y: number }) => {
    const api = apiRef.current;
    const value = text.trim();
    if (!api || !value) return;
    const mod = await import('@excalidraw/excalidraw');
    const scenePos = position ?? defaultPastePosition(lastAppStateRef.current);
    const skeleton = mod.convertToExcalidrawElements([
      {
        id: newId('pasted-text'),
        type: 'text',
        x: scenePos.x,
        y: scenePos.y,
        width: Math.min(520, Math.max(180, longestLineLength(value) * 12)),
        fontSize: 24,
        strokeColor: drawStrokeColorRef.current,
        text: value,
      },
    ] as never, { regenerateIds: false }) as unknown as DrawElement[];
    api.updateScene({
      elements: [...api.getSceneElements(), ...skeleton] as never,
      appState: { selectedElementIds: { [skeleton[0]?.id ?? '']: true } } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    api.scrollToContent(skeleton as never, { animate: true });
    scheduleSave();
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

  const centerCanvasContent = useCallback((animate = false) => {
    const api = apiRef.current;
    if (!api) return;
    const elements = (api.getSceneElements() as unknown as DrawElement[]).filter((element) => !element.isDeleted);
    if (elements.length === 0) return;
    const focusElements = initialCanvasFocusElements(elements);
    api.scrollToContent(focusElements as never, {
      animate,
      fitToViewport: true,
      viewportZoomFactor: 0.78,
      minZoom: 0.42,
      maxZoom: 1,
    });
  }, []);

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
      if (cancelled) return;
      const centerKey = `${boardId}:${conversationId}`;
      if (initialCenterKeyRef.current !== centerKey) {
        initialCenterKeyRef.current = centerKey;
        centerCanvasContent(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, boardId, centerCanvasContent, conversationId, tileHistoryToCanvas]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 40 && !apiRef.current && !cancelled; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const api = apiRef.current;
      if (cancelled || !api) return;
      const mod = await import('@excalidraw/excalidraw');
      const elements = api.getSceneElements() as unknown as DrawElement[];
      let changed = false;
      const next = elements.map((element) => {
        const normalized = normalizeVideoCanvasElement(element);
        if (normalized !== element) changed = true;
        return normalized;
      });
      if (!changed || cancelled) return;
      api.updateScene({
        elements: next as never,
        captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
      });
      refreshVideoNodeViews(next, lastAppStateRef.current);
      scheduleSave();
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, refreshVideoNodeViews, scheduleSave]);

  useEffect(() => {
    if (!ready) return;
    const root = document.body;
    const applyLabels = () => localizeExcalidrawContextMenu(root, t);
    applyLabels();
    const observer = new MutationObserver(applyLabels);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ready, t]);

  const createVideoFlow = useCallback(async (prompt: string, attachmentImages: ComposerImage[]) => {
    const api = apiRef.current;
    if (!api) return null;
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

    const nodeId = newId('video-node');
    const inputElementIds = imageRefs.map((item) => item.elementId);
    const videoNodeData: Record<string, unknown> = {
      kind: VIDEO_NODE_KIND,
      prompt,
      inputElementIds,
      trayOrder: inputElementIds,
      params: videoModelIdRef.current ? { modelConfigId: videoModelIdRef.current } : undefined,
    };
    const elements = (mod.convertToExcalidrawElements([{
      id: nodeId,
      type: 'rectangle',
      x: sourceRight + 90,
      y: sourceTop,
      width: VIDEO_NODE_WIDTH,
      height: VIDEO_NODE_HEIGHT,
      backgroundColor: 'transparent',
      strokeColor: 'transparent',
      fillStyle: 'solid',
      opacity: 0,
      roughness: 0,
      roundness: { type: 3 },
      customData: videoNodeData,
    }] as never, { regenerateIds: false }) as unknown as DrawElement[]).map((element) => normalizeVideoNodeElement({
      ...element,
      customData: videoNodeData,
    }));
    const nextElements = [...(api.getSceneElements() as unknown as DrawElement[]), ...elements];
    api.updateScene({
      elements: nextElements as never,
      appState: { selectedElementIds: {} } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    api.scrollToContent(elements as never, { animate: true });
    refreshVideoNodeViews(nextElements, lastAppStateRef.current);
    scheduleSave();
    return nodeId;
  }, [placeImage, refreshVideoNodeViews, scheduleSave, selectedImages]);

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

  const repairMissingImageAssetUrls = useCallback(async (drawElements: readonly DrawElement[]) => {
    const api = apiRef.current;
    if (!api) return;
    const files = api.getFiles() as Record<string, { dataURL?: string; mimeType?: string }>;
    const pending = drawElements.filter((element) => (
      element.type === 'image' &&
      !element.isDeleted &&
      !(typeof element.customData?.assetUrl === 'string' && element.customData.assetUrl.trim()) &&
      typeof element.fileId === 'string' &&
      typeof files[element.fileId]?.dataURL === 'string' &&
      !repairingImageAssetIdsRef.current.has(element.id)
    ));
    if (pending.length === 0) return;

    for (const element of pending) repairingImageAssetIdsRef.current.add(element.id);
    try {
      const repairedUrls = new Map<string, string>();
      for (const element of pending) {
        const dataURL = files[element.fileId as string]?.dataURL;
        if (!dataURL) continue;
        const file = dataUrlToFile(dataURL, `${element.id}.png`);
        repairedUrls.set(element.id, await uploadCanvasImageFile(file));
      }
      if (repairedUrls.size === 0) return;

      const mod = await import('@excalidraw/excalidraw');
      const current = api.getSceneElements() as unknown as DrawElement[];
      const next = current.map((element) => {
        const assetUrl = repairedUrls.get(element.id);
        return assetUrl
          ? {
              ...element,
              customData: {
                ...(element.customData ?? {}),
                assetUrl,
                label: typeof element.customData?.label === 'string' ? element.customData.label : 'Pasted image',
              },
            }
          : element;
      });
      api.updateScene({
        elements: next as never,
        captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
      });
      refreshVideoNodeViews(next, lastAppStateRef.current);
      scheduleSave();
    } finally {
      for (const element of pending) repairingImageAssetIdsRef.current.delete(element.id);
    }
  }, [refreshVideoNodeViews, scheduleSave, uploadCanvasImageFile]);

  // When a video node is natively duplicated (Ctrl+D / copy-paste) the copy
  // carries the original's projectId+generation, so generating on the copy would
  // clobber the original's project. Strip those from any node beyond the first
  // that claims a given projectId, turning duplicates into fresh nodes.
  const dedupeVideoNodeProjectIds = useCallback(async (drawElements: readonly DrawElement[]) => {
    const api = apiRef.current;
    if (!api) return;
    const seenProjectIds = new Set<string>();
    const stripIds = new Set<string>();
    for (const element of drawElements) {
      if (element.isDeleted || element.customData?.kind !== VIDEO_NODE_KIND) continue;
      const projectId = typeof element.customData?.projectId === 'string' ? element.customData.projectId : '';
      if (!projectId) continue;
      if (seenProjectIds.has(projectId)) stripIds.add(element.id);
      else seenProjectIds.add(projectId);
    }
    if (stripIds.size === 0) return;
    const mod = await import('@excalidraw/excalidraw');
    const next = (api.getSceneElements() as unknown as DrawElement[]).map((element) => {
      if (!stripIds.has(element.id)) return element;
      const rest = { ...(element.customData as Record<string, unknown> | null ?? {}) };
      delete rest.projectId;
      delete rest.generation;
      return { ...element, customData: rest };
    });
    api.updateScene({ elements: next as never, captureUpdate: mod.CaptureUpdateAction.NEVER as never });
    refreshVideoNodeViews(next, lastAppStateRef.current);
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave]);

  const onChange = useCallback((elements: readonly unknown[], appState: AppStateLike) => {
    const drawElements = elements as DrawElement[];
    void repairMissingImageAssetUrls(drawElements);
    void dedupeVideoNodeProjectIds(drawElements);
    const zoomValue = appState.zoom?.value ?? 1;
    const selectedIds = Object.keys(appState.selectedElementIds ?? {}).filter((id) => appState.selectedElementIds?.[id]);
    lastAppStateRef.current = appState;
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
    const hasSelectedVideoNode = selectedIds.some((id) => (
      drawElements.find((element) => element.id === id && !element.isDeleted)?.customData?.kind === VIDEO_NODE_KIND
    ));

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
      .map((el) => drawElementToImageRef(el as DrawElement, t('title')))
      .filter(hasImageUrl);
    setSelectedImages(imageRefs);
    if (hasSelectedVideoNode) {
      setMode('video');
    } else if (imageRefs.length === 1) {
      setMode('image');
    }

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

    const selectedArrow = selectedIds.length === 1
      ? drawElements.find((element) => element.id === selectedIds[0] && element.type === 'arrow' && !element.isDeleted)
      : null;
    setVideoLinkEditor((current) => {
      if (selectedArrow && isImageToImageArrow(selectedArrow, drawElements)) {
        return arrowToLinkEditor(selectedArrow, drawElements, appState, canvasRootRef.current?.getBoundingClientRect());
      }
      if (!current) return null;
      const currentArrow = drawElements.find((element) => element.id === current.id && element.type === 'arrow' && !element.isDeleted);
      return currentArrow && isImageToImageArrow(currentArrow, drawElements)
        ? arrowToLinkEditor(currentArrow, drawElements, appState, canvasRootRef.current?.getBoundingClientRect())
        : null;
    });
    refreshVideoNodeViews(drawElements, appState);

    if (sceneSig !== lastSceneChangeSigRef.current) {
      lastSceneChangeSigRef.current = sceneSig;
      scheduleSave();
    }
  }, [dedupeVideoNodeProjectIds, refreshVideoNodeViews, repairMissingImageAssetUrls, scheduleSave, t]);

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

  const updateVideoNodeData = useCallback(async (nodeId: string, patch: Partial<VideoNodeData>) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const next = elements.map((element) => (
      element.id === nodeId
        ? normalizeVideoNodeElement({
            ...element,
            customData: {
              ...(element.customData ?? {}),
              ...patch,
              kind: VIDEO_NODE_KIND,
            },
          })
        : element
    ));
    api.updateScene({
      elements: next as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    refreshVideoNodeViews(next, lastAppStateRef.current);
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave]);

  const updateVideoNodeParams = useCallback(async (nodeId: string, patch: NonNullable<VideoNodeData['params']>) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const next = elements.map((element) => {
      if (element.id !== nodeId) return element;
      const data = asRecord(element.customData) ?? {};
      const currentParams = asRecord(data.params) ?? {};
      const nextParams: Record<string, unknown> = { ...currentParams, ...patch };
      for (const key of Object.keys(nextParams)) {
        if (nextParams[key] === undefined || nextParams[key] === '') delete nextParams[key];
      }
      return normalizeVideoNodeElement({
        ...element,
        customData: {
          ...(element.customData ?? {}),
          kind: VIDEO_NODE_KIND,
          params: nextParams,
        },
      });
    });
    api.updateScene({
      elements: next as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    refreshVideoNodeViews(next, lastAppStateRef.current);
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave]);

  const updateArrowPrompt = useCallback(async (arrowId: string, prompt: string) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const next = elements.map((element) => (
      element.id === arrowId
        ? normalizeVideoLinkElement({
            ...element,
            customData: {
              ...(element.customData ?? {}),
              kind: VIDEO_LINK_KIND,
              role: 'sequence',
              prompt,
            },
          })
        : element
    ));
    api.updateScene({
      elements: next as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    setVideoLinkEditor((current) => current?.id === arrowId ? { ...current, prompt } : current);
    refreshVideoNodeViews(next, lastAppStateRef.current);
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave]);

  const addArrowPromptField = useCallback(async (arrowId: string) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const arrow = elements.find((element) => element.id === arrowId && element.type === 'arrow');
    if (!arrow || arrow.isDeleted || videoLinkRole(arrow) !== 'sequence') return;

    const next = elements.map((element) => (
      element.id === arrowId
        ? normalizeVideoLinkElement({
            ...element,
            customData: {
              ...(element.customData ?? {}),
              kind: VIDEO_LINK_KIND,
              role: 'sequence',
              prompt: '',
            },
          })
        : element
    ));
    api.updateScene({
      elements: next as never,
      appState: { selectedElementIds: {} } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    const updatedArrow = next.find((element) => element.id === arrowId && element.type === 'arrow' && !element.isDeleted);
    setVideoLinkEditor(updatedArrow
      ? arrowToLinkEditor(updatedArrow, next, lastAppStateRef.current, canvasRootRef.current?.getBoundingClientRect())
      : null);
    refreshVideoNodeViews(next, lastAppStateRef.current);
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave]);

  const deleteVideoLink = useCallback(async (arrowId: string) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const arrow = elements.find((element) => element.id === arrowId && element.type === 'arrow');
    if (!arrow || arrow.isDeleted) return;

    const sourceId = bindingElementId(arrow.startBinding);
    const targetId = bindingElementId(arrow.endBinding);
    const source = elements.find((element) => element.id === sourceId);
    const target = elements.find((element) => element.id === targetId);
    const shouldRemoveVideoInput = Boolean(
      sourceId &&
      targetId &&
      target?.customData?.kind === VIDEO_NODE_KIND &&
      !hasDirectInputVideoLink(elements, arrowId, sourceId, targetId),
    );
    const fallbackReferenceVideoNodeIds = sourceId && targetId && source?.type === 'image' && target?.type === 'image'
      ? reachableVideoNodeIdsFromImage(elements, targetId, arrowId)
      : [];

    const next = elements.map((element) => {
      let nextElement = element.id === arrowId ? { ...element, isDeleted: true } : element;
      if (element.id !== arrowId && (element.id === sourceId || element.id === targetId)) {
        nextElement = removeBoundArrowId(nextElement, arrowId);
      }
      if (shouldRemoveVideoInput && element.id === targetId && sourceId) {
        const data = asRecord(nextElement.customData) ?? {};
        nextElement = normalizeVideoNodeElement({
          ...nextElement,
          customData: {
            ...(nextElement.customData ?? {}),
            kind: VIDEO_NODE_KIND,
            inputElementIds: stringArray(data.inputElementIds).filter((id) => id !== sourceId),
            trayOrder: stringArray(data.trayOrder).filter((id) => id !== sourceId),
          },
        });
      }
      if (sourceId && targetId && fallbackReferenceVideoNodeIds.includes(element.id)) {
        const data = asRecord(nextElement.customData) ?? {};
        const fallbackIds = uniqueStrings([sourceId, targetId]);
        const nextInputIds = uniqueStrings([
          ...fallbackIds,
          ...stringArray(data.inputElementIds),
        ]);
        nextElement = normalizeVideoNodeElement({
          ...nextElement,
          customData: {
            ...(nextElement.customData ?? {}),
            kind: VIDEO_NODE_KIND,
            inputElementIds: nextInputIds,
            trayOrder: uniqueStrings([
              ...fallbackIds,
              ...stringArray(data.trayOrder),
              ...nextInputIds,
            ]),
          },
        });
      }
      return nextElement;
    });

    api.updateScene({
      elements: next as never,
      appState: { selectedElementIds: {} } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    setVideoLinkEditor((current) => current?.id === arrowId ? null : current);
    refreshVideoNodeViews(next, lastAppStateRef.current);
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave]);

  const optimizeVideoLinkPrompt = useCallback(async (arrowId: string, prompt: string): Promise<string | null> => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error('请输入镜头描述');
      return null;
    }
    setOptimizingVideoLinkId(arrowId);
    try {
      const optimized = await drawBoardActions.optimizeVideoPrompt({
        prompt: trimmed,
        modelId: selectedVideoModelId ?? undefined,
      });
      await updateArrowPrompt(arrowId, optimized);
      return optimized;
    } catch (error) {
      toast.error(errorMessage(error, t));
      return null;
    } finally {
      setOptimizingVideoLinkId((current) => current === arrowId ? null : current);
    }
  }, [selectedVideoModelId, t, updateArrowPrompt]);

  const optimizeVideoNodePrompt = useCallback(async (nodeId: string, prompt: string, modelId?: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error('请输入视频提示词');
      return;
    }
    setOptimizingVideoNodeId(nodeId);
    try {
      const optimized = await drawBoardActions.optimizeVideoPrompt({
        prompt: trimmed,
        modelId: modelId ?? selectedVideoModelId ?? undefined,
      });
      await updateVideoNodeData(nodeId, { prompt: optimized });
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setOptimizingVideoNodeId((current) => current === nodeId ? null : current);
    }
  }, [selectedVideoModelId, t, updateVideoNodeData]);

  const addVideoNode = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const sourceRight = selectedImages.length > 0
      ? Math.max(...selectedImages.map((image) => image.x + image.width))
      : -(lastAppStateRef.current.scrollX ?? 0) + 120;
    const sourceTop = selectedImages.length > 0
      ? Math.min(...selectedImages.map((image) => image.y))
      : -(lastAppStateRef.current.scrollY ?? 0) + 120;
    const nodeId = newId('video-node');
    const videoNodeData = {
      kind: VIDEO_NODE_KIND,
      prompt: '',
      inputElementIds: [],
      trayOrder: [],
      params: videoModelIdRef.current ? { modelConfigId: videoModelIdRef.current } : undefined,
    };
    const rawNode = {
      id: nodeId,
      type: 'rectangle',
      x: sourceRight + (selectedImages.length > 0 ? 72 : 0),
      y: sourceTop,
      width: VIDEO_NODE_WIDTH,
      height: VIDEO_NODE_HEIGHT,
      backgroundColor: 'transparent',
      strokeColor: 'transparent',
      fillStyle: 'solid',
      opacity: 0,
      roundness: { type: 3 },
      customData: videoNodeData,
    };
    const skeleton = (mod.convertToExcalidrawElements(
      [rawNode] as never,
      { regenerateIds: false },
    ) as unknown as DrawElement[]).map((element) => normalizeVideoNodeElement({
      ...element,
      customData: videoNodeData,
      backgroundColor: 'transparent',
      strokeColor: 'transparent',
      fillStyle: 'solid',
      opacity: 0,
      roughness: 0,
    }));

    api.updateScene({
      elements: [...elements, ...skeleton] as never,
      appState: { selectedElementIds: {} } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    api.scrollToContent(skeleton as never, { animate: true });
    setMode('video');
    refreshVideoNodeViews([...elements, ...skeleton], lastAppStateRef.current);
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave, selectedImages]);

  const createCanvasConnection = useCallback(async (sourceId: string, targetId: string) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const byId = new Map(elements.map((element) => [element.id, element] as const));
    const source = byId.get(sourceId);
    const target = byId.get(targetId);
    if (!source || !target || source.isDeleted || target.isDeleted || source.id === target.id) return;
    if (source.type !== 'image') return;

    const targetIsImage = target.type === 'image';
    const targetIsVideo = target.customData?.kind === VIDEO_NODE_KIND;
    if (!targetIsImage && !targetIsVideo) return;

    const key = `${source.id}->${target.id}`;
    if (collectBoundEdgeKeys(elements).has(key)) {
      toast.info(targetIsVideo ? '已经连接到视频节点' : '这两张图片已经连接');
      return;
    }

    const videoInputIds = targetIsVideo
      ? imageInputIdsForVideoConnection(elements, source.id, selectedElementIdsRef.current)
      : [source.id];

    const arrowSkeletons = [
      createBoundVideoArrowSkeleton(source, target, targetIsVideo ? 'input' : 'sequence'),
    ];
    const arrows = (mod.convertToExcalidrawElements(
      arrowSkeletons as never,
      { regenerateIds: false },
    ) as unknown as DrawElement[]).map((element, index) => normalizeVideoLinkElement({
      ...element,
      customData: arrowSkeletons[index]?.customData as Record<string, unknown> | undefined,
      startBinding: arrowSkeletons[index]?.startBinding,
      endBinding: arrowSkeletons[index]?.endBinding,
      strokeColor: arrowSkeletons[index]?.strokeColor,
      strokeWidth: arrowSkeletons[index]?.strokeWidth,
      strokeStyle: arrowSkeletons[index]?.strokeStyle,
      roughness: arrowSkeletons[index]?.roughness,
      opacity: arrowSkeletons[index]?.opacity,
      points: arrowSkeletons[index]?.points,
      endArrowhead: arrowSkeletons[index]?.endArrowhead,
      roundness: arrowSkeletons[index]?.roundness,
    }));
    const arrowIds = arrows.map((arrow) => arrow.id);
    const next = elements.map((element) => {
      if (targetIsVideo && element.id === target.id) {
        const data = asRecord(element.customData) ?? {};
        const nextInputIds = uniqueStrings([
          ...stringArray(data.inputElementIds),
          ...videoInputIds,
        ]);
        return normalizeVideoNodeElement({
          ...appendBoundArrowIds(element, arrowIds),
          customData: {
            ...(element.customData ?? {}),
            kind: VIDEO_NODE_KIND,
            inputElementIds: nextInputIds,
            trayOrder: uniqueStrings([...stringArray(data.trayOrder), ...nextInputIds]),
          },
        });
      }
      return element.id === source.id || element.id === target.id
        ? appendBoundArrowIds(element, arrowIds)
        : element;
    });

    api.updateScene({
      elements: [...next, ...arrows] as never,
      appState: { selectedElementIds: {} } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    refreshVideoNodeViews([...next, ...arrows], lastAppStateRef.current);
    if (targetIsVideo) setMode('video');
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave]);

  const setConnectionDragState = useCallback((next: CanvasConnectionDrag | null) => {
    connectionDragRef.current = next;
    setConnectionDrag(next);
  }, []);

  const startCanvasConnection = useCallback((sourceId: string, point: { x: number; y: number }) => {
    setConnectionDragState({
      sourceId,
      sourceX: point.x,
      sourceY: point.y,
      pointerX: point.x,
      pointerY: point.y,
      target: null,
    });
  }, [setConnectionDragState]);

  useEffect(() => {
    if (!connectionDrag) return;

    const onPointerMove = (event: PointerEvent) => {
      const current = connectionDragRef.current;
      if (!current) return;
      const point = canvasPointFromClient(event.clientX, event.clientY, canvasRootRef.current);
      const target = findCanvasConnectionTarget(
        point,
        current.sourceId,
        canvasImageViewsRef.current,
        videoNodeViewsRef.current,
      );
      setConnectionDragState({
        ...current,
        pointerX: point.x,
        pointerY: point.y,
        target,
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      const current = connectionDragRef.current;
      if (!current) return;
      const point = canvasPointFromClient(event.clientX, event.clientY, canvasRootRef.current);
      const target = current.target ?? findCanvasConnectionTarget(
        point,
        current.sourceId,
        canvasImageViewsRef.current,
        videoNodeViewsRef.current,
      );
      setConnectionDragState(null);
      if (target) void createCanvasConnection(current.sourceId, target.id);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [connectionDrag, createCanvasConnection, setConnectionDragState]);

  useEffect(() => {
    if (!videoLinkEditor) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-video-link-editor="true"], [data-video-link-control="true"], [data-model-picker-popover="true"]')) return;
      setVideoLinkEditor(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [videoLinkEditor]);

  const deleteVideoNode = useCallback(async (nodeId: string) => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const routeEdgeIds = new Set(readVideoComposition(elements, nodeId).sourceElementIds);
    // Shot/sequence arrows shared with another surviving video node must NOT be
    // deleted, or that node silently loses its shot line and its prompt.
    const otherRouteEdgeIds = new Set<string>();
    for (const element of elements) {
      if (element.id === nodeId || element.isDeleted) continue;
      if (element.customData?.kind !== VIDEO_NODE_KIND) continue;
      for (const id of readVideoComposition(elements, element.id).sourceElementIds) {
        otherRouteEdgeIds.add(id);
      }
    }
    const next = elements.map((element) => {
      if (element.type !== 'arrow') {
        return element.id === nodeId ? { ...element, isDeleted: true } : element;
      }
      const boundToNode = bindingElementId(element.startBinding) === nodeId
        || bindingElementId(element.endBinding) === nodeId;
      const exclusiveRouteArrow = element.customData?.kind === VIDEO_LINK_KIND
        && routeEdgeIds.has(element.id)
        && !otherRouteEdgeIds.has(element.id);
      return boundToNode || exclusiveRouteArrow
        ? { ...element, isDeleted: true }
        : element;
    });
    api.updateScene({
      elements: next as never,
      appState: { selectedElementIds: {} } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    setVideoLinkEditor(null);
    refreshVideoNodeViews(next, lastAppStateRef.current);
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave]);

  const arrangeVideoGraph = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const mod = await import('@excalidraw/excalidraw');
    const elements = api.getSceneElements() as unknown as DrawElement[];
    const byId = new Map(elements.map((element) => [element.id, element] as const));
    const targetVideoIds = targetVideoNodeIdsForLayout(elements, selectedElementIdsRef.current);
    if (targetVideoIds.length === 0) {
      toast.info('画布上还没有视频节点');
      return;
    }

    // Memoize the per-node pipeline (each call re-runs readVideoComposition).
    const routeImagesCache = new Map<string, string[]>();
    const routeImagesFor = (nodeId: string): string[] => {
      const cached = routeImagesCache.get(nodeId);
      if (cached) return cached;
      const value = orderedVideoPipelineImageIds(elements, nodeId);
      routeImagesCache.set(nodeId, value);
      return value;
    };

    const imageIds = uniqueStrings(targetVideoIds.flatMap((nodeId) => routeImagesFor(nodeId)));
    const images = imageIds
      .map((id) => byId.get(id))
      .filter((element): element is DrawElement => element !== undefined && element.type === 'image' && !element.isDeleted);
    const videoNodes = targetVideoIds
      .map((id) => byId.get(id))
      .filter((element): element is DrawElement => element !== undefined && !element.isDeleted && element.customData?.kind === VIDEO_NODE_KIND);
    if (videoNodes.length === 0) return;

    const imageHeights = images.map((image) => Math.abs(Number(image.height) || DEFAULT_IMAGE_SIZE));
    const rowHeight = Math.max(VIDEO_NODE_PANEL_HEIGHT, ...(imageHeights.length > 0 ? imageHeights : [VIDEO_NODE_PANEL_HEIGHT]));
    const layoutElements = [...images, ...videoNodes];
    const startX = Math.min(...layoutElements.map((element) => Number(element.x) || 0));
    const top = Math.min(...layoutElements.map((element) => Number(element.y) || 0));

    const allIds = new Set<string>([...images.map((image) => image.id), ...videoNodes.map((node) => node.id)]);
    const isNodeId = (id: string): boolean => byId.get(id)?.customData?.kind === VIDEO_NODE_KIND;
    const widthOf = (id: string): number => (
      isNodeId(id) ? VIDEO_NODE_WIDTH : Math.abs(Number(byId.get(id)?.width) || DEFAULT_IMAGE_SIZE)
    );
    const heightOf = (id: string): number => (
      isNodeId(id) ? VIDEO_NODE_PANEL_HEIGHT : Math.abs(Number(byId.get(id)?.height) || DEFAULT_IMAGE_SIZE)
    );

    // Build the route DAG: images -> ... -> video node, tracking which
    // image->image edges carry a shot description (they need room for the label).
    const successors = new Map<string, Set<string>>();
    const predecessors = new Map<string, Set<string>>();
    const describedPairs = new Set<string>();
    const addEdge = (from: string, to: string): void => {
      if (!allIds.has(from) || !allIds.has(to)) return;
      (successors.get(from) ?? successors.set(from, new Set()).get(from)!).add(to);
      (predecessors.get(to) ?? predecessors.set(to, new Set()).get(to)!).add(from);
    };
    for (const node of videoNodes) {
      const chain = routeImagesFor(node.id).filter((id) => allIds.has(id));
      for (const shot of readVideoComposition(elements, node.id).shots) {
        if (shot.prompt.trim()) describedPairs.add(`${shot.fromElementId}->${shot.toElementId}`);
      }
      for (let i = 0; i < chain.length - 1; i += 1) addEdge(chain[i], chain[i + 1]);
      if (chain.length > 0) addEdge(chain[chain.length - 1], node.id);
    }

    // Columns = longest path from a source, so the pipeline reads left -> right.
    const rankCache = new Map<string, number>();
    const rankOf = (id: string): number => {
      const cached = rankCache.get(id);
      if (cached !== undefined) return cached;
      rankCache.set(id, 0); // guard against accidental cycles
      const preds = predecessors.get(id);
      const rank = !preds || preds.size === 0 ? 0 : 1 + Math.max(...[...preds].map(rankOf));
      rankCache.set(id, rank);
      return rank;
    };
    const rankById = new Map<string, number>([...allIds].map((id) => [id, rankOf(id)] as const));
    const maxRank = Math.max(0, ...rankById.values());

    // Horizontal: per-column width + boundary gaps wide enough for shot labels.
    const BASE_GAP = 130;
    const LABEL_GAP = 360; // fits the ~320px shot-description chip between images
    const NODE_GAP = 96;
    const idsInColumn = (col: number): string[] => [...allIds].filter((id) => rankById.get(id) === col);
    const colWidth: number[] = [];
    for (let col = 0; col <= maxRank; col += 1) {
      const widths = idsInColumn(col).map(widthOf);
      colWidth[col] = widths.length > 0 ? Math.max(...widths) : DEFAULT_IMAGE_SIZE;
    }
    const colX: number[] = [startX];
    for (let col = 1; col <= maxRank; col += 1) {
      let gap = BASE_GAP;
      for (const [from, tos] of successors) {
        if (rankById.get(from) !== col - 1) continue;
        for (const to of tos) {
          if (rankById.get(to) !== col) continue;
          const need = describedPairs.has(`${from}->${to}`) ? LABEL_GAP : isNodeId(to) ? NODE_GAP : BASE_GAP;
          if (need > gap) gap = need;
        }
      }
      colX[col] = colX[col - 1] + colWidth[col - 1] + gap;
    }

    // Vertical: each sink (video node) gets an evenly spaced band; the trunk
    // (most images) sits on top. A shared upstream image sits at the AVERAGE
    // centre of every route it feeds — so the first image lands in the middle
    // of all its routes instead of clinging to one row.
    const sinkOrder = [...videoNodes]
      .map((node) => ({ id: node.id, span: routeImagesFor(node.id).length }))
      .sort((a, b) => b.span - a.span)
      .map((item) => item.id);
    const rowGap = rowHeight + 130;
    const baseCenterY = top + rowHeight / 2;
    const sinkCenterY = new Map<string, number>(sinkOrder.map((id, index) => [id, baseCenterY + index * rowGap] as const));
    const reachCache = new Map<string, Set<string>>();
    const reachableSinks = (id: string): Set<string> => {
      const cached = reachCache.get(id);
      if (cached) return cached;
      const result = new Set<string>();
      reachCache.set(id, result);
      if (sinkCenterY.has(id)) result.add(id);
      for (const to of successors.get(id) ?? []) for (const sink of reachableSinks(to)) result.add(sink);
      return result;
    };
    const centerYOf = (id: string): number => {
      const sinks = [...reachableSinks(id)];
      if (sinks.length === 0) return baseCenterY;
      return sinks.reduce((sum, sink) => sum + (sinkCenterY.get(sink) ?? baseCenterY), 0) / sinks.length;
    };

    // Place, stacking any siblings that share a column + centre so they never overlap.
    const positions = new Map<string, { x: number; y: number }>();
    for (let col = 0; col <= maxRank; col += 1) {
      const groups = new Map<number, string[]>();
      for (const id of idsInColumn(col)) {
        const key = Math.round(centerYOf(id));
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(id);
      }
      for (const [center, groupIds] of groups) {
        const gap = 40;
        const totalHeight = groupIds.reduce((sum, id) => sum + heightOf(id), 0) + gap * (groupIds.length - 1);
        let cursor = center - totalHeight / 2;
        for (const id of groupIds) {
          positions.set(id, { x: colX[col], y: cursor });
          cursor += heightOf(id) + gap;
        }
      }
    }

    // Every image not wired into any route (e.g. freshly pasted/copied images)
    // gets its own single row below the graph, so it can't overlap the arranged
    // pipeline and leave the layout looking broken.
    const routeImageIds = new Set(
      elements
        .filter((element) => !element.isDeleted && element.customData?.kind === VIDEO_NODE_KIND)
        .flatMap((node) => routeImagesFor(node.id)),
    );
    const unusedImages = elements.filter((element) => (
      element.type === 'image' && !element.isDeleted && !routeImageIds.has(element.id)
    ));
    if (unusedImages.length > 0) {
      const graphBottom = positions.size > 0
        ? Math.max(...[...positions].map(([id, pos]) => pos.y + heightOf(id)))
        : top + rowHeight;
      const unusedRowY = graphBottom + 120;
      const unusedGap = 60;
      let unusedX = startX;
      for (const image of unusedImages) {
        positions.set(image.id, { x: unusedX, y: unusedRowY });
        unusedX += Math.abs(Number(image.width) || DEFAULT_IMAGE_SIZE) + unusedGap;
      }
    }

    const next = elements.map((element) => {
      const position = positions.get(element.id);
      if (!position) return element;
      const moved = { ...element, x: position.x, y: position.y };
      return element.customData?.kind === VIDEO_NODE_KIND ? normalizeVideoNodeElement(moved) : moved;
    });

    api.updateScene({
      elements: next as never,
      appState: { selectedElementIds: Object.fromEntries(videoNodes.map((node) => [node.id, true])) } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    const focusElements = next.filter((element) => positions.has(element.id));
    api.scrollToContent(focusElements as never, {
      animate: true,
      fitToViewport: true,
      viewportZoomFactor: 0.78,
      minZoom: 0.42,
      maxZoom: 1,
    });
    setMode('video');
    refreshVideoNodeViews(next, lastAppStateRef.current);
    scheduleSave();
  }, [refreshVideoNodeViews, scheduleSave]);

  const openVideoWorkbench = useCallback(async (view: VideoNodeOverlayView) => {
    try {
      const ensured = await drawBoardActions.ensureVideoProjectForNode({
        projectId: view.projectId,
        title: title || t('untitled'),
      });
      if (ensured.projectId !== view.projectId) {
        await updateVideoNodeData(view.id, { projectId: ensured.projectId });
      }
      if (typeof window !== 'undefined') {
        window.location.assign(`/workbench/video?projectId=${encodeURIComponent(ensured.projectId)}`);
      }
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  }, [t, title, updateVideoNodeData]);

  const generateVideoNode = useCallback(async (view: VideoNodeOverlayView) => {
    const api = apiRef.current;
    if (!api || generatingVideoNodeIds.has(view.id)) return;
    const modelConfigId = view.modelConfigId ?? videoModelIdRef.current;
    if (!modelConfigId) {
      toast.error(t('chat.noVideoModel'));
      return;
    }

    const pendingId = newId('m');
    const promptLabel = view.prompt.trim() || videoModeLabel(view.composition.mode);
    setGeneratingVideoNodeIds((current) => new Set(current).add(view.id));
    setMessages((messages) => [
      ...messages,
      { id: newId('m'), role: 'user', text: promptLabel },
      { id: pendingId, role: 'assistant', text: '', pending: true },
    ]);

    try {
      const elements = api.getSceneElements() as unknown as DrawElement[];
      const composition = readVideoComposition(elements, view.id);
      const blocking = composition.issues.find((issue) => issue.level === 'blocking');
      if (blocking) throw new Error(blocking.message);

      await updateVideoNodeData(view.id, {
        generation: { status: 'generating' },
      });
      void drawBoardActions.appendConversationMessage(conversationId, {
        role: 'USER',
        content: promptLabel,
        metadata: {
          messageType: 'draw_video_node_prompt',
          videoNodeId: view.id,
          mode: composition.mode,
        },
      }).catch(() => undefined);

      const ensured = await drawBoardActions.ensureVideoProjectForNode({
        projectId: view.projectId,
        title: title || t('untitled'),
      });
      if (ensured.projectId !== view.projectId) {
        await updateVideoNodeData(view.id, { projectId: ensured.projectId });
      }

      // Honour the node's persisted params (ratio/duration/resolution) instead
      // of hardcoding — a node configured for another ratio/duration must not
      // silently generate at 16:9/1080p (which some models also reject).
      const nodeParams = asRecord(
        (elements.find((element) => element.id === view.id)?.customData ?? {}).params,
      ) ?? {};
      const started = await drawBoardActions.startVideoComposition(ensured.projectId, {
        mode: composition.mode,
        prompt: composition.prompt,
        firstFrameUrl: composition.firstFrameUrl,
        lastFrameUrl: composition.lastFrameUrl,
        referenceUrls: composition.referenceUrls,
        shots: composition.shots,
        issues: composition.issues,
        params: {
          modelConfigId,
          duration: typeof nodeParams.duration === 'number' ? nodeParams.duration : 5,
          ratio: typeof nodeParams.ratio === 'string' ? nodeParams.ratio : '16:9',
          resolution: typeof nodeParams.resolution === 'string' ? nodeParams.resolution : '1080p',
          generateAudio: typeof nodeParams.generateAudio === 'boolean' ? nodeParams.generateAudio : true,
        },
      });

      // This flow already polls below; mark the generation so the resume effect
      // doesn't spin up a second concurrent poll for the same id.
      resumedVideoGenerationIdsRef.current.add(started.generationId);
      await updateVideoNodeData(view.id, {
        projectId: ensured.projectId,
        generation: { status: 'generating', generationId: started.generationId },
      });
      const result = await drawBoardActions.pollVideoGeneration(started.projectId, started.generationId);
      if (result.status !== 'completed' || !result.videoUrl) {
        throw new Error(result.error || t('chat.videoFailed'));
      }

      await updateVideoNodeData(view.id, {
        projectId: ensured.projectId,
        generation: {
          status: 'completed',
          generationId: started.generationId,
          videoUrl: result.videoUrl,
          thumbnailUrl: result.thumbnailUrl ?? undefined,
        },
      });
      const text = `${t('chat.done')}：${promptLabel}`;
      setMessages((messages) => messages.map((message) => (
        message.id === pendingId ? { ...message, pending: false, text, videos: [result.videoUrl!] } : message
      )));
      void drawBoardActions.appendConversationMessage(conversationId, {
        role: 'ASSISTANT',
        content: text,
        metadata: {
          messageType: 'draw_video_node_result',
          videoNodeId: view.id,
          projectId: ensured.projectId,
          videos: [result.videoUrl],
          thumbnailUrl: result.thumbnailUrl ?? undefined,
        },
      }).catch(() => undefined);
    } catch (error) {
      const text = errorMessage(error, t);
      await updateVideoNodeData(view.id, {
        generation: { status: 'failed', error: text },
      });
      setMessages((messages) => messages.map((message) => (
        message.id === pendingId ? { ...message, pending: false, error: true, text } : message
      )));
      void drawBoardActions.appendConversationMessage(conversationId, {
        role: 'ASSISTANT',
        content: text,
        metadata: { messageType: 'error', videoNodeId: view.id },
      }).catch(() => undefined);
    } finally {
      setGeneratingVideoNodeIds((current) => {
        const next = new Set(current);
        next.delete(view.id);
        return next;
      });
      void refreshConversations().catch(() => undefined);
    }
  }, [
    conversationId,
    generatingVideoNodeIds,
    refreshConversations,
    t,
    title,
    updateVideoNodeData,
  ]);

  useEffect(() => {
    for (const view of videoNodeViews) {
      const generationId = view.generation?.generationId;
      if (
        view.generation?.status !== 'generating' ||
        !view.projectId ||
        !generationId ||
        resumedVideoGenerationIdsRef.current.has(generationId)
      ) {
        continue;
      }
      resumedVideoGenerationIdsRef.current.add(generationId);
      setGeneratingVideoNodeIds((current) => new Set(current).add(view.id));
      void (async () => {
        try {
          const result = await drawBoardActions.pollVideoGeneration(view.projectId!, generationId);
          if (result.status === 'completed' && result.videoUrl) {
            await updateVideoNodeData(view.id, {
              generation: {
                status: 'completed',
                generationId,
                videoUrl: result.videoUrl,
                thumbnailUrl: result.thumbnailUrl ?? undefined,
              },
            });
          } else {
            await updateVideoNodeData(view.id, {
              generation: {
                status: result.status,
                generationId,
                error: result.error ?? undefined,
              },
            });
          }
        } finally {
          setGeneratingVideoNodeIds((current) => {
            const next = new Set(current);
            next.delete(view.id);
            return next;
          });
        }
      })();
    }
  }, [updateVideoNodeData, videoNodeViews]);

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
        await placeImage(await uploadCanvasImageFile(file), file.name);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addComposerFiles, placeImage, t, uploadCanvasImageFile]);

  const openUpload = useCallback((target: UploadTarget) => {
    uploadTargetRef.current = target;
    fileInputRef.current?.click();
  }, []);

  const pasteCanvasClipboard = useCallback(async (
    clipboardData: DataTransfer | null,
    position?: { x: number; y: number },
  ) => {
    if (!canCreateCanvasPasteElement(clipboardData)) return false;

    const files = getClipboardImageFiles(clipboardData);
    const text = clipboardData?.getData('text/plain') ?? '';
    // Use Excalidraw's LIVE appState (scroll/zoom) so the paste lands in the
    // current viewport — the cached lastAppStateRef can lag a pan/zoom and drop
    // the image off-screen near the origin.
    const liveAppState = (apiRef.current?.getAppState() as AppStateLike | undefined) ?? lastAppStateRef.current;
    const basePosition = position ?? defaultPastePosition(
      liveAppState,
      canvasRootRef.current?.getBoundingClientRect(),
    );

    if (files.length > 0) {
      const placed: DrawElement[] = [];
      for (let i = 0; i < files.slice(0, 8).length; i += 1) {
        const file = files[i];
        const url = await uploadCanvasImageFile(file);
        const element = await placeImage(url, file.name || `Pasted image ${i + 1}`, {
          x: basePosition.x + i * 28,
          y: basePosition.y + i * 28,
        }, { reveal: false });
        if (element) placed.push(element);
      }
      // Select and reveal the pasted image(s) so they land in view — otherwise
      // a stale scroll can drop the copy off-screen and the layout looks broken.
      const api = apiRef.current;
      if (api && placed.length > 0) {
        const currentZoom = api.getAppState().zoom?.value ?? liveAppState.zoom?.value ?? 1;
        api.updateScene({
          appState: { selectedElementIds: Object.fromEntries(placed.map((element) => [element.id, true])) } as never,
        });
        api.scrollToContent(placed as never, {
          animate: true,
          minZoom: currentZoom,
          maxZoom: currentZoom,
        });
      }
      return true;
    }

    await addCanvasText(text, basePosition);
    return true;
  }, [addCanvasText, placeImage, uploadCanvasImageFile]);

  const handleComposerPaste = useCallback((event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    void addComposerFiles(files);
  }, [addComposerFiles]);

  const handleCanvasPaste = useCallback((event: ReactClipboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (isEditablePasteTarget(event.target)) return;
    if (!canCreateCanvasPasteElement(event.clipboardData)) return;

    stopHandledPasteEvent(event);
    const liveAppState = (apiRef.current?.getAppState() as AppStateLike | undefined) ?? lastAppStateRef.current;
    void pasteCanvasClipboard(event.clipboardData, pastePositionFromEvent(event, liveAppState));
  }, [pasteCanvasClipboard]);

  useEffect(() => {
    if (!ready) return;

    const onDocumentPaste = (event: globalThis.ClipboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditablePasteTarget(event.target)) return;
      if (!isCanvasPasteContext(event.target, canvasRootRef.current)) return;
      if (!canCreateCanvasPasteElement(event.clipboardData)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void pasteCanvasClipboard(event.clipboardData);
    };

    document.addEventListener('paste', onDocumentPaste, true);
    return () => document.removeEventListener('paste', onDocumentPaste, true);
  }, [pasteCanvasClipboard, ready]);

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
          ref={canvasRootRef}
          className="draw-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black"
          onDragOver={(event) => {
            if (Array.from(event.dataTransfer.items).some((item) => item.kind === 'file')) event.preventDefault();
          }}
          onDrop={handleCanvasDrop}
          onPasteCapture={handleCanvasPaste}
        >
          {ready && initialData ? (
            <Excalidraw
              excalidrawAPI={handleExcalidrawAPI}
              initialData={excalidrawInitialData}
              onChange={onChange as never}
              UIOptions={excalidrawUIOptions}
              theme="dark"
              langCode={excalidrawLangCode(locale)}
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

          {videoNodeViews.map((view) => {
            const nodeModelId = view.modelConfigId ?? selectedVideoModelId;
            const nodeSelectedVideoModel = videoModels.find((model) => model.id === nodeModelId) ?? selectedVideoModel;
            return (
              <VideoNodeOverlay
                key={view.id}
                t={t}
                view={view}
                generating={generatingVideoNodeIds.has(view.id)}
                optimizingPrompt={optimizingVideoNodeId === view.id}
                modelPicker={(
                  <DrawModelPicker
                    t={t}
                    models={videoModels}
                    selectedModel={nodeSelectedVideoModel}
                    selectedModelId={nodeModelId ?? null}
                    loading={modelsLoading}
                    triggerClassName="inline-flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.08] px-2 text-xs font-semibold text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                    onChange={(id) => {
                      selectVideoModel(id);
                      void updateVideoNodeParams(view.id, { modelConfigId: id ?? undefined });
                    }}
                  />
                )}
                onPromptChange={(value) => void updateVideoNodeData(view.id, { prompt: value })}
                onOptimizePrompt={() => void optimizeVideoNodePrompt(view.id, view.prompt, nodeModelId ?? undefined)}
                onShotPromptChange={(linkElementId, prompt) => void updateArrowPrompt(linkElementId, prompt)}
                onShotOrderChange={(shotOrder) => void updateVideoNodeData(view.id, { shotOrder })}
                onDelete={() => void deleteVideoNode(view.id)}
                onGenerate={() => void generateVideoNode(view)}
                onOpenWorkbench={() => void openVideoWorkbench(view)}
                onMeasure={syncVideoNodeSize}
              />
            );
          })}

          <VideoCanvasEdges
            edges={videoLinkLabels}
            onSelectEdge={(edge) => {
              setVideoLinkEditor(edge);
            }}
            onDeleteEdge={(edgeId) => void deleteVideoLink(edgeId)}
          />

          <CanvasConnectionHandles
            images={canvasImageViews}
            videos={videoNodeViews}
            drag={connectionDrag}
            onStartConnection={startCanvasConnection}
          />

          {videoLinkEditor && (
            videoLinkEditor.hasPromptField ? (
              <LinePromptEditor
                edgeId={videoLinkEditor.id}
                value={videoLinkEditor.prompt}
                left={videoLinkEditor.screenX + 12}
                top={videoLinkEditor.screenY + 16}
                optimizing={optimizingVideoLinkId === videoLinkEditor.id}
                modelPicker={(
                  <DrawModelPicker
                    t={t}
                    models={videoModels}
                    selectedModel={selectedVideoModel}
                    selectedModelId={selectedVideoModelId}
                    loading={modelsLoading}
                    triggerClassName="inline-flex h-8 min-w-0 max-w-[220px] items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.08] px-2 text-xs font-semibold text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                    onChange={selectVideoModel}
                  />
                )}
                onCommit={(value) => void updateArrowPrompt(videoLinkEditor.id, value)}
                onOptimize={(value) => optimizeVideoLinkPrompt(videoLinkEditor.id, value)}
                onDelete={() => void deleteVideoLink(videoLinkEditor.id)}
                onClose={() => setVideoLinkEditor(null)}
              />
            ) : (
              <LineActionPopover
                edge={videoLinkEditor}
                left={videoLinkEditor.screenX + 12}
                top={videoLinkEditor.screenY + 16}
                onAddPrompt={videoLinkEditor.role === 'sequence'
                  ? () => void addArrowPromptField(videoLinkEditor.id)
                  : undefined}
                onDelete={() => void deleteVideoLink(videoLinkEditor.id)}
              />
            )
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
            onGenVideo={() => void addVideoNode()}
            onArrangeVideo={() => void arrangeVideoGraph()}
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
                      selectVideoModel(id);
                    } else {
                      selectImageModel(id);
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

function CanvasConnectionHandles(props: {
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

function VideoCanvasEdges(props: {
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
      aria-label={title}
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

function LinePromptEditor(props: {
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

function LineActionPopover(props: {
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

function ReferenceStrip(props: {
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

function buildCanvasImageNodeViews(
  elements: readonly DrawElement[],
  appState: AppStateLike,
  fallbackLabel: string,
): CanvasImageNodeView[] {
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  return elements
    .filter((element) => element.type === 'image' && !element.isDeleted)
    .map((element) => {
      const image = drawElementToImageRef(element, fallbackLabel);
      return {
        ...image,
        screenX: (Number(element.x) + scrollX) * zoom,
        screenY: (Number(element.y) + scrollY) * zoom,
        screenWidth: Math.max(1, Math.abs(Number(element.width) || image.width || DEFAULT_IMAGE_SIZE) * zoom),
        screenHeight: Math.max(1, Math.abs(Number(element.height) || image.height || DEFAULT_IMAGE_SIZE) * zoom),
      };
    });
}

function imageInputHandlePoint(image: CanvasImageNodeView): { x: number; y: number } {
  return {
    x: image.screenX,
    y: image.screenY + image.screenHeight / 2,
  };
}

function imageOutputHandlePoint(image: CanvasImageNodeView): { x: number; y: number } {
  return {
    x: image.screenX + image.screenWidth,
    y: image.screenY + image.screenHeight / 2,
  };
}

function videoInputHandlePoint(view: VideoNodeOverlayView): { x: number; y: number } {
  const rect = videoPanelScreenRect(view);
  return {
    x: rect.left,
    y: rect.top + 40,
  };
}

function videoPanelScreenRect(view: VideoNodeOverlayView): { left: number; top: number; width: number; height: number } {
  return videoPanelRectFromGeometry(
    view.screenX,
    view.screenY,
    view.width,
    view.canvasWidth,
    view.canvasHeight,
  );
}

function videoPanelRectFromGeometry(
  screenX: number,
  screenY: number,
  rawWidth: number,
  canvasWidth?: number,
  canvasHeight?: number,
): { left: number; top: number; width: number; height: number } {
  // Anchor to the node's screen position with no viewport clamping, so the
  // panel rect (and the connection handles derived from it) track the node 1:1
  // when the canvas is panned. Must match VideoNodeOverlay's positioning.
  void canvasWidth;
  void canvasHeight;
  const width = Math.max(240, Math.min(420, rawWidth));
  return { left: screenX, top: screenY, width, height: 220 };
}

function findCanvasConnectionTarget(
  point: { x: number; y: number },
  sourceId: string,
  images: readonly CanvasImageNodeView[],
  videos: readonly VideoNodeOverlayView[],
): CanvasConnectionTarget | null {
  const candidates: CanvasConnectionTarget[] = [
    ...images
      .filter((image) => image.elementId !== sourceId)
      .map((image) => {
        const handle = imageInputHandlePoint(image);
        return { id: image.elementId, kind: 'image' as const, x: handle.x, y: handle.y };
      }),
    ...videos.map((video) => {
      const handle = videoInputHandlePoint(video);
      return { id: video.id, kind: 'video' as const, x: handle.x, y: handle.y };
    }),
  ];
  let nearest: { target: CanvasConnectionTarget; distance: number } | null = null;
  for (const target of candidates) {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance > 30) continue;
    if (!nearest || distance < nearest.distance) nearest = { target, distance };
  }
  return nearest?.target ?? null;
}

function canvasPointFromClient(clientX: number, clientY: number, root: HTMLElement | null): { x: number; y: number } {
  const rect = root?.getBoundingClientRect();
  return {
    x: clientX - (rect?.left ?? 0),
    y: clientY - (rect?.top ?? 0),
  };
}

function buildVideoNodeViews(
  elements: readonly DrawElement[],
  appState: AppStateLike,
  fallbackLabel: string,
  canvasRect?: DOMRect,
): VideoNodeOverlayView[] {
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  const byId = new Map(elements.map((element) => [element.id, element] as const));
  return elements
    .filter((element) => !element.isDeleted && element.customData?.kind === VIDEO_NODE_KIND)
    .map((element) => {
      const composition = readVideoComposition(elements, element.id);
      const data = asRecord(element.customData) ?? {};
      const inputIds = uniqueStrings([
        ...stringArray(data.inputElementIds),
        ...stringArray(data.referenceElementIds),
        ...composition.sourceElementIds.filter((id) => byId.get(id)?.type === 'image'),
      ]);
      const inputImages: VideoNodeOverlayImage[] = inputIds
        .map((id) => byId.get(id))
        .filter((item): item is DrawElement => item !== undefined && item.type === 'image' && !item.isDeleted)
        .map((image) => drawElementToImageRef(image, fallbackLabel))
        .filter((image) => image.url)
        .map((image) => ({
          elementId: image.elementId,
          url: image.url,
          label: image.label,
        }));
      const generation = asRecord(data.generation);
      const params = asRecord(data.params);
      return {
        id: element.id,
        screenX: (Number(element.x) + scrollX) * zoom,
        screenY: (Number(element.y) + scrollY) * zoom,
        width: Math.max(340, (Number(element.width) || 420) * zoom),
        height: (Number(element.height) || 270) * zoom,
        zoom,
        canvasWidth: canvasRect?.width,
        canvasHeight: canvasRect?.height,
        prompt: typeof data.prompt === 'string' ? data.prompt : '',
        projectId: typeof data.projectId === 'string' ? data.projectId : undefined,
        modelConfigId: typeof params?.modelConfigId === 'string' ? params.modelConfigId : undefined,
        generation: generation
          ? {
              status: typeof generation.status === 'string' ? generation.status : undefined,
              generationId: typeof generation.generationId === 'string' ? generation.generationId : undefined,
              videoUrl: typeof generation.videoUrl === 'string' ? generation.videoUrl : undefined,
              thumbnailUrl: typeof generation.thumbnailUrl === 'string' ? generation.thumbnailUrl : undefined,
              error: typeof generation.error === 'string' ? generation.error : undefined,
            }
          : undefined,
        inputImages,
        composition,
      };
    });
}

function arrowToLinkEditor(
  element: DrawElement,
  elements: readonly DrawElement[],
  appState: AppStateLike,
  canvasRect?: DOMRect,
  order?: number,
  plainLabel?: string,
): VideoLinkEditorInfo {
  const data = asRecord(element.customData);
  const role = data?.role === 'input' ? 'input' : 'sequence';
  const hasPromptField = Boolean(data && Object.prototype.hasOwnProperty.call(data, 'prompt'));
  const route = buildVideoEdgeRoute(element, elements, appState, canvasRect);
  return {
    id: element.id,
    screenX: route.label.x,
    screenY: route.label.y,
    startX: route.start.x,
    startY: route.start.y,
    endX: route.end.x,
    endY: route.end.y,
    path: route.path,
    role,
    prompt: typeof data?.prompt === 'string' ? data.prompt : '',
    hasPromptField,
    order,
    plainLabel,
  };
}

function buildVideoLinkLabels(
  elements: readonly DrawElement[],
  appState: AppStateLike,
  canvasRect?: DOMRect,
): VideoLinkLabelInfo[] {
  const byId = new Map(elements.map((element) => [element.id, element] as const));
  const arrows = elements
    .filter((element) => isDrawableVideoLink(element, byId))
    .sort((left, right) => compareVideoLinksSpatially(left, right, byId));
  const sequenceArrows = arrows.filter((element) => videoLinkRole(element) === 'sequence');
  const sequenceOrder = new Map(sequenceArrows.map((element, index) => [element.id, index + 1] as const));
  const plainCount = sequenceArrows.filter((element) => !arrowHasPromptField(element)).length;

  return arrows.map((element) => {
    const role = videoLinkRole(element);
    const hasPromptField = arrowHasPromptField(element);
    return arrowToLinkEditor(
      element,
      elements,
      appState,
      canvasRect,
      role === 'sequence' ? sequenceOrder.get(element.id) : undefined,
      role === 'sequence' && !hasPromptField ? (plainCount === 1 ? '首尾' : '序列') : undefined,
    );
  });
}

function orderedVideoPipelineImageIds(elements: readonly DrawElement[], videoNodeId: string): string[] {
  const byId = new Map(elements.map((element) => [element.id, element] as const));
  const composition = readVideoComposition(elements, videoNodeId);
  const candidateIds = composition.sourceElementIds.filter((id) => {
    const element = byId.get(id);
    return element?.type === 'image' && !element.isDeleted;
  });
  const candidateSet = new Set(candidateIds);

  if (composition.shots.length > 0) {
    return uniqueStrings(composition.shots.flatMap((shot) => [shot.fromElementId, shot.toElementId]))
      .filter((id) => candidateSet.has(id));
  }

  const sequenceEdges = elements
    .filter((element) => (
      element.type === 'arrow' &&
      !element.isDeleted &&
      element.customData?.kind === VIDEO_LINK_KIND &&
      videoLinkRole(element) === 'sequence' &&
      !arrowHasPromptField(element) &&
      candidateSet.has(bindingElementId(element.startBinding) ?? '') &&
      candidateSet.has(bindingElementId(element.endBinding) ?? '')
    ))
    .sort((left, right) => compareVideoLinksSpatially(left, right, byId));

  if (sequenceEdges.length > 0) {
    return uniqueStrings([
      ...orderedImagesFromSequenceEdges(sequenceEdges),
      ...candidateIds,
    ]).filter((id) => candidateSet.has(id));
  }

  return candidateIds;
}

function initialCanvasFocusElements(elements: readonly DrawElement[]): DrawElement[] {
  const active = elements.filter((element) => !element.isDeleted);
  const videoNodes = active
    .filter((element) => element.customData?.kind === VIDEO_NODE_KIND)
    .sort(compareElementsSpatially);
  if (videoNodes.length > 0) {
    const focusIds = new Set(videoNodes.map((element) => element.id));
    for (const node of videoNodes) {
      for (const sourceId of readVideoComposition(active, node.id).sourceElementIds) {
        focusIds.add(sourceId);
      }
    }
    const focused = active.filter((element) => (
      focusIds.has(element.id) &&
      (element.type === 'image' || element.customData?.kind === VIDEO_NODE_KIND)
    ));
    if (focused.length > 0) return focused;
  }

  const images = active.filter((element) => element.type === 'image');
  if (images.length > 0) return images;

  const nonConnectorElements = active.filter((element) => element.type !== 'arrow');
  return nonConnectorElements.length > 0 ? nonConnectorElements : active;
}

function targetVideoNodeIdsForLayout(elements: readonly DrawElement[], selectedIds: readonly string[]): string[] {
  const selected = new Set(selectedIds);
  const videoNodes = elements
    .filter((element) => !element.isDeleted && element.customData?.kind === VIDEO_NODE_KIND)
    .sort(compareElementsSpatially);
  const selectedVideoNodeIds = videoNodes
    .filter((element) => selected.has(element.id))
    .map((element) => element.id);
  if (selectedVideoNodeIds.length > 0) return selectedVideoNodeIds;

  const selectedInputIds = elements
    .filter((element) => selected.has(element.id) && !element.isDeleted && (element.type === 'image' || element.type === 'arrow'))
    .map((element) => element.id);
  if (selectedInputIds.length > 0) {
    const selectedInputSet = new Set(selectedInputIds);
    const related = videoNodes
      .filter((node) => readVideoComposition(elements, node.id).sourceElementIds.some((id) => selectedInputSet.has(id)))
      .map((node) => node.id);
    if (related.length > 0) return related;
  }

  return videoNodes.map((node) => node.id);
}

function orderedImagesFromSequenceEdges(edges: readonly DrawElement[]): string[] {
  const incoming = new Set(edges.map((edge) => bindingElementId(edge.endBinding)).filter((id): id is string => Boolean(id)));
  const outgoing = new Map<string, DrawElement[]>();
  for (const edge of edges) {
    const from = bindingElementId(edge.startBinding);
    if (!from) continue;
    const list = outgoing.get(from) ?? [];
    list.push(edge);
    outgoing.set(from, list);
  }

  const usedEdges = new Set<string>();
  const out: string[] = [];
  const starts = edges.filter((edge) => {
    const from = bindingElementId(edge.startBinding);
    return from ? !incoming.has(from) : false;
  });
  const orderedStarts = starts.length > 0 ? starts : edges;

  for (const start of orderedStarts) {
    let edge: DrawElement | undefined = start;
    while (edge && !usedEdges.has(edge.id)) {
      usedEdges.add(edge.id);
      const from = bindingElementId(edge.startBinding);
      const to = bindingElementId(edge.endBinding);
      if (from) out.push(from);
      if (to) out.push(to);
      edge = to ? outgoing.get(to)?.find((next) => !usedEdges.has(next.id)) : undefined;
    }
  }

  for (const edge of edges) {
    const from = bindingElementId(edge.startBinding);
    const to = bindingElementId(edge.endBinding);
    if (from) out.push(from);
    if (to) out.push(to);
  }

  return uniqueStrings(out);
}

function videoLinkLabelText(label: VideoLinkLabelInfo): string {
  const prefix = label.hasPromptField && label.order ? `${label.order} · ` : '';
  if (label.prompt.trim()) return `${prefix}${label.prompt.trim()}`;
  return label.hasPromptField ? `${prefix}添加描述` : label.plainLabel ?? '序列';
}

function arrowHasPromptField(element: DrawElement): boolean {
  const data = asRecord(element.customData);
  return Boolean(data && Object.prototype.hasOwnProperty.call(data, 'prompt'));
}

function videoLinkRole(element: DrawElement): 'sequence' | 'input' {
  const data = asRecord(element.customData);
  return data?.role === 'input' ? 'input' : 'sequence';
}

function isDrawableVideoLink(element: DrawElement, byId: Map<string, DrawElement>): boolean {
  if (element.type !== 'arrow' || element.isDeleted || element.customData?.kind !== VIDEO_LINK_KIND) return false;
  const start = byId.get(bindingElementId(element.startBinding) ?? '');
  const end = byId.get(bindingElementId(element.endBinding) ?? '');
  if (!start || !end || start.isDeleted || end.isDeleted) return false;
  return start.type === 'image' && (end.type === 'image' || end.customData?.kind === VIDEO_NODE_KIND);
}

function elementCenter(element: DrawElement): { x: number; y: number } {
  return {
    x: Number(element.x) + Number(element.width) / 2,
    y: Number(element.y) + Number(element.height) / 2,
  };
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

type EdgeAnchorSide = 'left' | 'right' | 'top' | 'bottom';

interface EdgeAnchor extends ScreenPoint {
  side: EdgeAnchorSide;
}

interface VideoEdgeRoute {
  start: EdgeAnchor;
  end: EdgeAnchor;
  label: ScreenPoint;
  path: string;
}

function buildVideoEdgeRoute(
  element: DrawElement,
  elements: readonly DrawElement[],
  appState: AppStateLike,
  canvasRect?: DOMRect,
): VideoEdgeRoute {
  const byId = new Map(elements.map((item) => [item.id, item] as const));
  const from = byId.get(bindingElementId(element.startBinding) ?? '');
  const to = byId.get(bindingElementId(element.endBinding) ?? '');
  if (from && to) return buildElementEdgeRoute(from, to, appState, canvasRect);
  return fallbackArrowRoute(element, appState);
}

function buildElementEdgeRoute(
  from: DrawElement,
  to: DrawElement,
  appState: AppStateLike,
  canvasRect?: DOMRect,
): VideoEdgeRoute {
  const source = elementScreenBox(from, appState);
  const target = to.customData?.kind === VIDEO_NODE_KIND
    ? videoElementPanelScreenBox(to, appState, canvasRect)
    : elementScreenBox(to, appState);
  const route = smoothEdgeRoute(
    { x: source.right, y: source.centerY, side: 'right' },
    { x: target.left, y: to.customData?.kind === VIDEO_NODE_KIND ? target.top + 40 : target.centerY, side: 'left' },
  );
  if (from.type === 'image' && to.type === 'image') {
    // Sit the label just above the actual line midpoint. The old
    // `min(top) - 36` floated it far above tall portrait images because the
    // line runs through their vertical centre, not their tops.
    return { ...route, label: { x: route.label.x, y: route.label.y - 22 } };
  }
  return route;
}

function elementScreenBox(element: DrawElement, appState: AppStateLike): ScreenBox {
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  const left = (Number(element.x) + scrollX) * zoom;
  const top = (Number(element.y) + scrollY) * zoom;
  const width = Math.max(1, Math.abs(Number(element.width) || 1) * zoom);
  const height = Math.max(1, Math.abs(Number(element.height) || 1) * zoom);
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
}

function videoElementPanelScreenBox(element: DrawElement, appState: AppStateLike, canvasRect?: DOMRect): ScreenBox {
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  const rect = videoPanelRectFromGeometry(
    (Number(element.x) + scrollX) * zoom,
    (Number(element.y) + scrollY) * zoom,
    Math.max(340, (Number(element.width) || VIDEO_NODE_WIDTH) * zoom),
    canvasRect?.width,
    canvasRect?.height,
  );
  return {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  };
}

function smoothEdgeRoute(start: EdgeAnchor, end: EdgeAnchor): VideoEdgeRoute {
  const horizontal = start.side === 'left' || start.side === 'right';
  const direction = horizontal
    ? (start.side === 'right' ? 1 : -1)
    : (start.side === 'bottom' ? 1 : -1);
  const distance = horizontal ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y);
  const offset = Math.max(48, Math.min(160, distance * 0.42));
  const c1 = horizontal
    ? { x: start.x + direction * offset, y: start.y }
    : { x: start.x, y: start.y + direction * offset };
  const c2 = horizontal
    ? { x: end.x - direction * offset, y: end.y }
    : { x: end.x, y: end.y - direction * offset };
  const label = cubicPoint(start, c1, c2, end, 0.5);
  return {
    start,
    end,
    label,
    path: [
      'M',
      coord(start.x),
      coord(start.y),
      'C',
      coord(c1.x),
      coord(c1.y),
      coord(c2.x),
      coord(c2.y),
      coord(end.x),
      coord(end.y),
    ].join(' '),
  };
}

function fallbackArrowRoute(element: DrawElement, appState: AppStateLike): VideoEdgeRoute {
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  const points = Array.isArray(element.points) ? element.points as Array<[number, number]> : [];
  const first = points[0] ?? [0, 0];
  const last = points.at(-1) ?? [Number(element.width) || 0, Number(element.height) || 0];
  const start = {
    x: (Number(element.x) + first[0] + scrollX) * zoom,
    y: (Number(element.y) + first[1] + scrollY) * zoom,
    side: 'right' as const,
  };
  const end = {
    x: (Number(element.x) + last[0] + scrollX) * zoom,
    y: (Number(element.y) + last[1] + scrollY) * zoom,
    side: 'left' as const,
  };
  return {
    start,
    end,
    label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    path: `M ${coord(start.x)} ${coord(start.y)} L ${coord(end.x)} ${coord(end.y)}`,
  };
}

function cubicPoint(p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, p3: ScreenPoint, tValue: number): ScreenPoint {
  const mt = 1 - tValue;
  const mt2 = mt * mt;
  const t2 = tValue * tValue;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * tValue * p1.x + 3 * mt * t2 * p2.x + t2 * tValue * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * tValue * p1.y + 3 * mt * t2 * p2.y + t2 * tValue * p3.y,
  };
}

function coord(value: number): number {
  return Math.round(value * 10) / 10;
}

function connectionPoint(from: DrawElement, to: DrawElement): { x: number; y: number } {
  const fromCenter = elementCenter(from);
  const toCenter = elementCenter(to);
  const halfW = Math.max(1, Number(from.width) / 2);
  const halfH = Math.max(1, Number(from.height) / 2);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  if (Math.abs(dx) * halfH > Math.abs(dy) * halfW) {
    return {
      x: fromCenter.x + Math.sign(dx || 1) * halfW,
      y: fromCenter.y + (dy / Math.max(Math.abs(dx), 1)) * halfW,
    };
  }
  return {
    x: fromCenter.x + (dx / Math.max(Math.abs(dy), 1)) * halfH,
    y: fromCenter.y + Math.sign(dy || 1) * halfH,
  };
}

function compareElementsSpatially(left: DrawElement | undefined, right: DrawElement | undefined): number {
  const lx = Number(left?.x ?? 0);
  const rx = Number(right?.x ?? 0);
  if (lx !== rx) return lx - rx;
  return Number(left?.y ?? 0) - Number(right?.y ?? 0);
}

function compareVideoLinksSpatially(left: DrawElement, right: DrawElement, byId: Map<string, DrawElement>): number {
  const leftStart = byId.get(bindingElementId(left.startBinding) ?? '');
  const rightStart = byId.get(bindingElementId(right.startBinding) ?? '');
  const startOrder = compareElementsSpatially(leftStart, rightStart);
  if (startOrder !== 0) return startOrder;
  return compareElementsSpatially(
    byId.get(bindingElementId(left.endBinding) ?? ''),
    byId.get(bindingElementId(right.endBinding) ?? ''),
  );
}

function collectBoundEdgeKeys(elements: readonly DrawElement[]): Set<string> {
  const keys = new Set<string>();
  for (const element of elements) {
    if (element.type !== 'arrow' || element.isDeleted || element.customData?.kind !== VIDEO_LINK_KIND) continue;
    const from = bindingElementId(element.startBinding);
    const to = bindingElementId(element.endBinding);
    if (from && to) keys.add(`${from}->${to}`);
  }
  return keys;
}

function createBoundVideoArrowSkeleton(
  from: DrawElement,
  to: DrawElement,
  role: 'sequence' | 'input',
  prompt?: string,
): Record<string, unknown> {
  const start = connectionPoint(from, to);
  const end = connectionPoint(to, from);
  const customData: Record<string, unknown> = { kind: VIDEO_LINK_KIND, role };
  if (prompt !== undefined) customData.prompt = prompt;
  return {
    id: newId(role === 'sequence' ? 'video-sequence-link' : 'video-input-link'),
    type: 'arrow',
    x: start.x,
    y: start.y,
    width: end.x - start.x,
    height: end.y - start.y,
    angle: 0,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 0,
    points: [[0, 0], [end.x - start.x, end.y - start.y]],
    startBinding: { elementId: from.id, focus: 0, gap: 12 },
    endBinding: { elementId: to.id, focus: 0, gap: 12 },
    endArrowhead: 'arrow',
    startArrowhead: null,
    roundness: { type: 2 },
    locked: true,
    customData,
  };
}

function appendBoundArrowIds(element: DrawElement, arrowIds: readonly string[]): DrawElement {
  const existing = Array.isArray(element.boundElements)
    ? element.boundElements.filter((item): item is { id: string; type: string } => (
        item !== null &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string' &&
        typeof (item as { type?: unknown }).type === 'string'
      ))
    : [];
  const existingIds = new Set(existing.map((item) => item.id));
  const additions = arrowIds
    .filter((id) => !existingIds.has(id))
    .map((id) => ({ id, type: 'arrow' }));
  return additions.length > 0
    ? { ...element, boundElements: [...existing, ...additions] }
    : element;
}

function removeBoundArrowId(element: DrawElement, arrowId: string): DrawElement {
  if (!Array.isArray(element.boundElements)) return element;
  const next = element.boundElements.filter((item) => {
    if (!item || typeof item !== 'object') return true;
    return (item as { id?: unknown }).id !== arrowId;
  });
  return next.length === element.boundElements.length ? element : { ...element, boundElements: next };
}

function hasDirectInputVideoLink(
  elements: readonly DrawElement[],
  ignoredArrowId: string,
  sourceId: string,
  videoNodeId: string,
): boolean {
  return elements.some((element) => (
    element.id !== ignoredArrowId &&
    element.type === 'arrow' &&
    !element.isDeleted &&
    element.customData?.kind === VIDEO_LINK_KIND &&
    videoLinkRole(element) === 'input' &&
    bindingElementId(element.startBinding) === sourceId &&
    bindingElementId(element.endBinding) === videoNodeId
  ));
}

function reachableVideoNodeIdsFromImage(
  elements: readonly DrawElement[],
  imageId: string,
  ignoredArrowId: string,
): string[] {
  const byId = new Map(elements.map((element) => [element.id, element] as const));
  const out: string[] = [];
  const seen = new Set<string>([imageId]);
  const stack = [imageId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    for (const element of elements) {
      if (
        element.id === ignoredArrowId ||
        element.type !== 'arrow' ||
        element.isDeleted ||
        element.customData?.kind !== VIDEO_LINK_KIND ||
        bindingElementId(element.startBinding) !== currentId
      ) {
        continue;
      }
      const nextId = bindingElementId(element.endBinding);
      if (!nextId || seen.has(nextId)) continue;
      const next = byId.get(nextId);
      if (!next || next.isDeleted) continue;
      if (next.customData?.kind === VIDEO_NODE_KIND) {
        out.push(next.id);
        seen.add(next.id);
      } else if (next.type === 'image') {
        seen.add(next.id);
        stack.push(next.id);
      }
    }
  }
  return uniqueStrings(out);
}

function imageInputIdsForVideoConnection(
  elements: readonly DrawElement[],
  sourceId: string,
  selectedIds: readonly string[],
): string[] {
  const selected = new Set(selectedIds);
  if (!selected.has(sourceId)) return [sourceId];
  const selectedImages = elements
    .filter((element) => selected.has(element.id) && element.type === 'image' && !element.isDeleted)
    .sort(compareElementsSpatially)
    .map((element) => element.id);
  return selectedImages.length > 1 ? uniqueStrings(selectedImages) : [sourceId];
}

function isImageToImageArrow(element: DrawElement, elements: readonly DrawElement[]): boolean {
  const byId = new Map(elements.map((item) => [item.id, item] as const));
  const start = byId.get(bindingElementId(element.startBinding) ?? '');
  const end = byId.get(bindingElementId(element.endBinding) ?? '');
  return start?.type === 'image' && !start.isDeleted && end?.type === 'image' && !end.isDeleted;
}


function videoModeLabel(mode: VideoCompositionMode): string {
  if (mode === 'text_to_video') return '文生视频';
  if (mode === 'image_to_video') return '图生视频';
  if (mode === 'first_last_frame') return '首尾帧';
  if (mode === 'storyboard') return '分镜';
  return '参考图';
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

function excalidrawLangCode(locale: string): string {
  if (locale === 'zh-CN') return 'zh-CN';
  if (locale === 'zh-TW') return 'zh-TW';
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'ja') return 'ja-JP';
  if (locale === 'ru') return 'ru-RU';
  if (locale === 'vi') return 'vi-VN';
  return 'en';
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
  const rawAssetUrl = el.customData?.assetUrl;
  const assetUrl = typeof rawAssetUrl === 'string' ? rawAssetUrl.trim() : '';
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

function normalizeVideoCanvasElement(element: DrawElement): DrawElement {
  return normalizeVideoLinkElement(normalizeVideoNodeElement(element));
}

function normalizeVideoLinkElement(element: DrawElement): DrawElement {
  if (element.customData?.kind !== VIDEO_LINK_KIND) return element;
  const normalized = {
    ...element,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 0,
    locked: true,
    customData: {
      ...(element.customData ?? {}),
      kind: VIDEO_LINK_KIND,
    },
  };
  const unchanged =
    element.strokeColor === normalized.strokeColor &&
    element.backgroundColor === normalized.backgroundColor &&
    element.strokeWidth === normalized.strokeWidth &&
    element.strokeStyle === normalized.strokeStyle &&
    element.roughness === normalized.roughness &&
    element.opacity === normalized.opacity &&
    element.locked === normalized.locked;
  return unchanged ? element : normalized;
}

function normalizeVideoNodeElement(element: DrawElement): DrawElement {
  if (element.customData?.kind !== VIDEO_NODE_KIND) return element;
  // Keep the node invisible, but DON'T force width/height — the real size is
  // measured from the rendered panel (see syncVideoNodeSize). Forcing a fixed
  // size here would fight that sync and shrink the selection box.
  const normalized = {
    ...element,
    backgroundColor: 'transparent',
    strokeColor: 'transparent',
    fillStyle: 'solid',
    opacity: 0,
    roughness: 0,
    customData: {
      ...(element.customData ?? {}),
      kind: VIDEO_NODE_KIND,
    },
  };
  const unchanged =
    element.backgroundColor === normalized.backgroundColor &&
    element.strokeColor === normalized.strokeColor &&
    element.fillStyle === normalized.fillStyle &&
    element.opacity === normalized.opacity &&
    element.roughness === normalized.roughness;
  return unchanged ? element : normalized;
}

function hasImageUrl(image: { url: string }): boolean {
  return image.url.trim().length > 0;
}

function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('textarea,input,select,[contenteditable="true"]'));
}

function isCanvasPasteContext(target: EventTarget | null, canvasRoot: HTMLElement | null): boolean {
  if (!canvasRoot || typeof document === 'undefined') return false;
  if (target instanceof Element && canvasRoot.contains(target)) return true;

  const active = document.activeElement;
  if (active === document.body || active === document.documentElement) return true;
  return active instanceof Element && canvasRoot.contains(active);
}

function canCreateCanvasPasteElement(clipboardData: DataTransfer | null): boolean {
  if (!clipboardData || hasExcalidrawClipboardData(clipboardData)) return false;
  return getClipboardImageFiles(clipboardData).length > 0 || Boolean(clipboardData.getData('text/plain').trim());
}

function getClipboardImageFiles(clipboardData: DataTransfer | null): File[] {
  return Array.from(clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
}

function hasExcalidrawClipboardData(clipboardData: DataTransfer): boolean {
  return Array.from(clipboardData.types).some((type) => type.toLowerCase().includes('excalidraw'));
}

function pastePositionFromEvent(event: ReactClipboardEvent<HTMLDivElement>, appState: AppStateLike): { x: number; y: number } {
  return defaultPastePosition(appState, event.currentTarget.getBoundingClientRect());
}

function defaultPastePosition(appState: AppStateLike, rect?: DOMRect): { x: number; y: number } {
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  const screenX = rect ? rect.width * 0.5 : 360;
  const screenY = rect ? rect.height * 0.42 : 220;
  return {
    x: Math.round(screenX / zoom - scrollX),
    y: Math.round(screenY / zoom - scrollY),
  };
}

function longestLineLength(value: string): number {
  return value.split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0);
}

function dataUrlToFile(dataURL: string, name: string): File {
  const [header = '', payload = ''] = dataURL.split(',');
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? 'image/png';
  if (header.includes(';base64')) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], name, { type: mimeType });
  }
  return new File([decodeURIComponent(payload)], name, { type: mimeType });
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
