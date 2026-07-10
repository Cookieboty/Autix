import type { VideoNodeOverlayImage, VideoNodeOverlayView } from './VideoNodeOverlay';
import { DEFAULT_IMAGE_SIZE } from './draw-constants';
import {
  buildVideoEdgeRoute,
  imageInputHandlePoint,
  videoInputHandlePoint,
} from './draw-canvas-geometry';
import { drawElementToImageRef } from './draw-image-helpers';
import type { DrawElement } from './draw-scene-mapper';
import type {
  AppStateLike,
  CanvasConnectionTarget,
  CanvasImageNodeView,
  Tr,
  VideoLinkEditorInfo,
  VideoLinkLabelInfo,
} from './draw-types';
import {
  VIDEO_LINK_KIND,
  VIDEO_NODE_KIND,
  bindingId as bindingElementId,
  readVideoComposition,
  stringArray,
  uniqueStrings,
  type VideoCompositionMode,
} from './draw-video-graph';
import { asRecord, newId } from './draw-workspace-helpers';

export function buildCanvasImageNodeViews(
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

export function findCanvasConnectionTarget(
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

export function canvasPointFromClient(clientX: number, clientY: number, root: HTMLElement | null): { x: number; y: number } {
  const rect = root?.getBoundingClientRect();
  return {
    x: clientX - (rect?.left ?? 0),
    y: clientY - (rect?.top ?? 0),
  };
}

export function buildVideoNodeViews(
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

export function arrowToLinkEditor(
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

export function buildVideoLinkLabels(
  elements: readonly DrawElement[],
  appState: AppStateLike,
  canvasRect?: DOMRect,
  t?: Tr,
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
      role === 'sequence' && !hasPromptField
        ? (plainCount === 1 ? t?.('video.firstLast') ?? 'First/Last' : t?.('video.sequence') ?? 'Sequence')
        : undefined,
    );
  });
}

export function orderedVideoPipelineImageIds(elements: readonly DrawElement[], videoNodeId: string): string[] {
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

export function initialCanvasFocusElements(elements: readonly DrawElement[]): DrawElement[] {
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

export function targetVideoNodeIdsForLayout(elements: readonly DrawElement[], selectedIds: readonly string[]): string[] {
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

export function orderedImagesFromSequenceEdges(edges: readonly DrawElement[]): string[] {
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

export function arrowHasPromptField(element: DrawElement): boolean {
  const data = asRecord(element.customData);
  return Boolean(data && Object.prototype.hasOwnProperty.call(data, 'prompt'));
}

export function videoLinkRole(element: DrawElement): 'sequence' | 'input' {
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

export function compareElementsSpatially(left: DrawElement | undefined, right: DrawElement | undefined): number {
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

export function collectBoundEdgeKeys(elements: readonly DrawElement[]): Set<string> {
  const keys = new Set<string>();
  for (const element of elements) {
    if (element.type !== 'arrow' || element.isDeleted || element.customData?.kind !== VIDEO_LINK_KIND) continue;
    const from = bindingElementId(element.startBinding);
    const to = bindingElementId(element.endBinding);
    if (from && to) keys.add(`${from}->${to}`);
  }
  return keys;
}

export function createBoundVideoArrowSkeleton(
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

export function appendBoundArrowIds(element: DrawElement, arrowIds: readonly string[]): DrawElement {
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

export function removeBoundArrowId(element: DrawElement, arrowId: string): DrawElement {
  if (!Array.isArray(element.boundElements)) return element;
  const next = element.boundElements.filter((item) => {
    if (!item || typeof item !== 'object') return true;
    return (item as { id?: unknown }).id !== arrowId;
  });
  return next.length === element.boundElements.length ? element : { ...element, boundElements: next };
}

export function hasDirectInputVideoLink(
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

export function reachableVideoNodeIdsFromImage(
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

export function imageInputIdsForVideoConnection(
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

export function isImageToImageArrow(element: DrawElement, elements: readonly DrawElement[]): boolean {
  const byId = new Map(elements.map((item) => [item.id, item] as const));
  const start = byId.get(bindingElementId(element.startBinding) ?? '');
  const end = byId.get(bindingElementId(element.endBinding) ?? '');
  return start?.type === 'image' && !start.isDeleted && end?.type === 'image' && !end.isDeleted;
}

export function videoModeLabel(mode: VideoCompositionMode, t?: Tr): string {
  if (mode === 'text_to_video') return t?.('video.modes.textToVideo') ?? 'Text to video';
  if (mode === 'image_to_video') return t?.('video.modes.imageToVideo') ?? 'Image to video';
  if (mode === 'first_last_frame') return t?.('video.modes.firstLastFrame') ?? 'First/last frame';
  if (mode === 'storyboard') return t?.('video.modes.storyboard') ?? 'Storyboard';
  return t?.('video.modes.reference') ?? 'Reference image';
}

export function normalizeVideoCanvasElement(element: DrawElement): DrawElement {
  return normalizeVideoLinkElement(normalizeVideoNodeElement(element));
}

export function normalizeVideoLinkElement(element: DrawElement): DrawElement {
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

export function normalizeVideoNodeElement(element: DrawElement): DrawElement {
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
