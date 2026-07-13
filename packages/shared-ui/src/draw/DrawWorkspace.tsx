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
} from 'react';
import dynamic from 'next/dynamic';
import {
  Layers,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Wand2,
  Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { drawBoardActions, uploadFileToStorage, type Conversation, type ModelConfigItem } from '@autix/shared-store';
import {
  type DrawElement,
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
  type VideoNodeData,
} from './draw-video-graph';
import { VideoNodeOverlay, videoIssueMessage, type VideoNodeOverlayView } from './VideoNodeOverlay';
import { DrawChatPanel } from './DrawChatPanel';
import {
  BottomDock,
  CanvasConnectionHandles,
  ContextualToolbar,
  DrawModelPicker,
  IconBtn,
  LineActionPopover,
  LinePromptEditor,
  QuickEditBox,
  VideoCanvasEdges,
} from './DrawWorkspaceParts';
import {
  appendBoundArrowIds,
  arrowToLinkEditor,
  buildCanvasImageNodeViews,
  buildVideoLinkLabels,
  buildVideoNodeViews,
  canvasPointFromClient,
  collectBoundEdgeKeys,
  createBoundVideoArrowSkeleton,
  findCanvasConnectionTarget,
  hasDirectInputVideoLink,
  imageInputIdsForVideoConnection,
  initialCanvasFocusElements,
  isImageToImageArrow,
  normalizeVideoCanvasElement,
  normalizeVideoLinkElement,
  normalizeVideoNodeElement,
  orderedVideoPipelineImageIds,
  reachableVideoNodeIdsFromImage,
  removeBoundArrowId,
  targetVideoNodeIdsForLayout,
  videoLinkRole,
  videoModeLabel,
} from './draw-canvas-view-models';
import {
  DEFAULT_IMAGE_SIZE,
  DEFAULT_STROKE_COLOR,
  DRAW_UPLOAD_FOLDER,
  GENERIC_CONVERSATION_TITLES,
  HIDE_EXCALIDRAW_UI,
  SAVE_DEBOUNCE_MS,
  TITLE_SAVE_DEBOUNCE_MS,
  VIDEO_NODE_HEIGHT,
  VIDEO_NODE_PANEL_HEIGHT,
  VIDEO_NODE_WIDTH,
} from './draw-constants';
import {
  canCreateCanvasPasteElement,
  defaultPastePosition,
  getClipboardImageFiles,
  getClipboardImageUrl,
  getClipboardPlainText,
  getCopiedCanvasImagesFromClipboard,
  hasExcalidrawClipboardData,
  imageLabelFromUrl,
  isCanvasPasteContext,
  isEditablePasteTarget,
  longestLineLength,
  pastePositionFromEvent,
} from './draw-clipboard';
import {
  dataUrlToFile,
  downloadUrl,
  drawElementToImageRef,
  fitWithinBox,
  hasImageUrl,
  measureImage,
  readFileAsDataUrl,
  toExcalidrawDataUrl,
} from './draw-image-helpers';
import {
  combinedSignature,
  conversationMessageToChatMessage,
  toPersistedMessages,
} from './draw-message-helpers';
import {
  asRecord,
  errorMessage,
  excalidrawLangCode,
  isColorableElement,
  isConflict,
  localizeExcalidrawContextMenu,
  newId,
  normalizeTool,
  saveLabel,
  stopHandledPasteEvent,
  tr,
} from './draw-workspace-helpers';
import type {
  AppStateLike,
  CanvasConnectionDrag,
  CanvasImageFileSource,
  CanvasImageNodeView,
  CanvasImageRef,
  ChatMessage,
  ComposerImage,
  CopiedCanvasImage,
  GenerationMode,
  SelectionInfo,
  Tool,
  Tr,
  UploadTarget,
  VideoLinkEditorInfo,
  VideoLinkLabelInfo,
} from './draw-types';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  { ssr: false },
);

export interface DrawWorkspaceProps {
  boardId: string;
  conversationId: string;
  onConversationChange: (conversationId: string) => void;
  modelConfigId?: string;
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
  const copiedCanvasImagesRef = useRef<CopiedCanvasImage[] | null>(null);
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
    setVideoLinkLabels(buildVideoLinkLabels(elements, appState, canvasRect, t));
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
    options?: { dataURL?: string; reveal?: boolean },
  ): Promise<DrawElement | null> => {
    const api = apiRef.current;
    if (!api) return null;

    const mod = await import('@excalidraw/excalidraw');
    const fileId = newId('file');
    const dataURL = options?.dataURL ?? await toExcalidrawDataUrl(url);
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

  const prepareCanvasImageFile = useCallback(async (file: File): Promise<CanvasImageFileSource> => {
    const dataURL = await readFileAsDataUrl(file);
    try {
      const uploaded = await uploadFileToStorage(file, {
        folder: DRAW_UPLOAD_FOLDER,
        contentType: file.type || 'image/png',
      });
      if (uploaded.publicUrl) return { assetUrl: uploaded.publicUrl, dataURL };
    } catch {
      // Keep canvas paste/upload usable when object storage is unavailable.
    }
    return { assetUrl: dataURL, dataURL };
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

  const pasteCopiedCanvasImages = useCallback(async (images?: CopiedCanvasImage[] | null) => {
    const copied = images ?? copiedCanvasImagesRef.current;
    const api = apiRef.current;
    if (!api || !copied?.length) return false;

    const placed: DrawElement[] = [];
    for (const image of copied) {
      const element = await placeImage(image.url, image.label, {
        x: image.x + 28,
        y: image.y + 28,
      }, { reveal: false });
      if (!element) continue;
      placed.push({
        ...element,
        width: image.width,
        height: image.height,
      });
    }
    if (placed.length === 0) return false;

    const mod = await import('@excalidraw/excalidraw');
    const current = api.getSceneElements() as unknown as DrawElement[];
    const byId = new Map(placed.map((element) => [element.id, element] as const));
    const next = current.map((element) => byId.get(element.id) ?? element);
    api.updateScene({
      elements: next as never,
      appState: { selectedElementIds: Object.fromEntries(placed.map((element) => [element.id, true])) } as never,
      captureUpdate: mod.CaptureUpdateAction.IMMEDIATELY as never,
    });
    const currentZoom = api.getAppState().zoom?.value ?? lastAppStateRef.current.zoom?.value ?? 1;
    api.scrollToContent(placed as never, {
      animate: true,
      minZoom: currentZoom,
      maxZoom: currentZoom,
    });
    scheduleSave();
    return true;
  }, [placeImage, scheduleSave]);

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
        repairedUrls.set(element.id, (await prepareCanvasImageFile(file)).assetUrl);
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
  }, [refreshVideoNodeViews, scheduleSave, prepareCanvasImageFile]);

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
      toast.error(t('video.errors.enterShotDescription'));
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
      toast.error(t('video.errors.enterVideoPrompt'));
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
      toast.info(targetIsVideo ? t('video.alreadyConnectedToVideoNode') : t('video.imagesAlreadyConnected'));
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
      toast.info(t('video.noVideoNodesOnCanvas'));
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
        window.location.assign(`/ai/video?projectId=${encodeURIComponent(ensured.projectId)}`);
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
    const promptLabel = view.prompt.trim() || videoModeLabel(view.composition.mode, t);
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
      if (blocking) throw new Error(videoIssueMessage(blocking, t));

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
        const source = await prepareCanvasImageFile(file);
        await placeImage(source.assetUrl, file.name, undefined, { dataURL: source.dataURL });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addComposerFiles, placeImage, t, prepareCanvasImageFile]);

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
        const source = await prepareCanvasImageFile(file);
        const element = await placeImage(source.assetUrl, file.name || `Pasted image ${i + 1}`, {
          x: basePosition.x + i * 28,
          y: basePosition.y + i * 28,
        }, { dataURL: source.dataURL, reveal: false });
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

    const imageUrl = getClipboardImageUrl(clipboardData);
    if (imageUrl) {
      const element = await placeImage(imageUrl, imageLabelFromUrl(imageUrl), basePosition, { reveal: false });
      const api = apiRef.current;
      if (api && element) {
        const currentZoom = api.getAppState().zoom?.value ?? liveAppState.zoom?.value ?? 1;
        api.updateScene({
          appState: { selectedElementIds: { [element.id]: true } } as never,
        });
        api.scrollToContent([element] as never, {
          animate: true,
          minZoom: currentZoom,
          maxZoom: currentZoom,
        });
      }
      return true;
    }

    await addCanvasText(text, basePosition);
    return true;
  }, [addCanvasText, placeImage, prepareCanvasImageFile]);

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

    const onDocumentCopy = () => {
      const api = apiRef.current;
      if (!api) {
        copiedCanvasImagesRef.current = null;
        return;
      }
      const selectedIds = new Set(selectedElementIdsRef.current);
      if (selectedIds.size === 0) {
        copiedCanvasImagesRef.current = null;
        return;
      }
      const selected = (api.getSceneElements() as unknown as DrawElement[]).filter((element) => (
        selectedIds.has(element.id) && !element.isDeleted
      ));
      if (selected.length === 0 || selected.some((element) => element.type !== 'image')) {
        copiedCanvasImagesRef.current = null;
        return;
      }
      const copied = selected
        .map((element) => drawElementToImageRef(element, t('title')))
        .filter(hasImageUrl)
        .map((image) => ({
          url: image.url,
          label: image.label,
          x: image.x,
          y: image.y,
          width: image.width,
          height: image.height,
        }));
      copiedCanvasImagesRef.current = copied.length === selected.length ? copied : null;
    };

    const onDocumentPaste = (event: globalThis.ClipboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditablePasteTarget(event.target)) return;
      if (!isCanvasPasteContext(event.target, canvasRootRef.current)) return;
      if (event.clipboardData && hasExcalidrawClipboardData(event.clipboardData)) {
        const copiedImages = getCopiedCanvasImagesFromClipboard(event.clipboardData) ?? copiedCanvasImagesRef.current;
        if (!copiedImages?.length) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void pasteCopiedCanvasImages(copiedImages);
        return;
      }
      if (!canCreateCanvasPasteElement(event.clipboardData)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void pasteCanvasClipboard(event.clipboardData);
    };

    document.addEventListener('copy', onDocumentCopy, true);
    document.addEventListener('paste', onDocumentPaste, true);
    return () => {
      document.removeEventListener('copy', onDocumentCopy, true);
      document.removeEventListener('paste', onDocumentPaste, true);
    };
  }, [pasteCanvasClipboard, pasteCopiedCanvasImages, ready, t]);

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
            t={t}
            edges={videoLinkLabels}
            onSelectEdge={(edge) => {
              setVideoLinkEditor(edge);
            }}
            onDeleteEdge={(edgeId) => void deleteVideoLink(edgeId)}
          />

          <CanvasConnectionHandles
            t={t}
            images={canvasImageViews}
            videos={videoNodeViews}
            drag={connectionDrag}
            onStartConnection={startCanvasConnection}
          />

          {videoLinkEditor && (
            videoLinkEditor.hasPromptField ? (
              <LinePromptEditor
                t={t}
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
                t={t}
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
          <DrawChatPanel
            t={t}
            mode={mode}
            activeTitle={activeTitle}
            messages={messages}
            conversationId={conversationId}
            conversationMenuOpen={conversationMenuOpen}
            conversations={filteredConversations}
            conversationSearch={conversationSearch}
            creatingConversation={creatingConversation}
            pickerModels={pickerModels}
            pickerSelectedModel={pickerSelectedModel}
            pickerSelectedModelId={pickerSelectedModelId}
            modelsLoading={modelsLoading}
            canGenerate={canGenerate}
            showUpsell={showUpsell}
            entitlementReason={entitlementReason}
            selectedImages={selectedImages}
            composerImages={composerImages}
            composerRef={composerRef}
            input={input}
            generating={generating}
            canSend={canSend}
            onSearchConversations={setConversationSearch}
            onToggleConversationMenu={() => {
              setConversationMenuOpen((value) => !value);
              void refreshConversations().catch(() => undefined);
            }}
            onCreateConversation={() => void createConversation()}
            onSelectConversation={(id) => {
              setConversationMenuOpen(false);
              onConversationChange(id);
            }}
            onShare={() => void shareCurrentConversation()}
            onModelChange={(id) => {
              if (isVideoMode) {
                selectVideoModel(id);
              } else {
                selectImageModel(id);
              }
            }}
            onTileHistoryToCanvas={() => void tileHistoryToCanvas()}
            onLocateOrPlace={(url, label) => void locateOrPlace(url, label)}
            onDismissUpsell={() => setShowUpsell(false)}
            onRemoveComposerImage={(id) => setComposerImages((items) => items.filter((item) => item.id !== id))}
            onInputChange={setInput}
            onComposerPaste={handleComposerPaste}
            onOpenUpload={openUpload}
            onSubmit={() => void submit()}
          />
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onUpload(e.target.files)} />
    </div>
  );
}
