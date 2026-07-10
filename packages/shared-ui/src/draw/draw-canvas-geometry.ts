import type { VideoNodeOverlayView } from './VideoNodeOverlay';
import { VIDEO_NODE_WIDTH } from './draw-constants';
import type { DrawElement } from './draw-scene-mapper';
import type { AppStateLike, CanvasImageNodeView, Tr, VideoLinkLabelInfo } from './draw-types';
import { VIDEO_NODE_KIND, bindingId as bindingElementId } from './draw-video-graph';

export function imageInputHandlePoint(image: CanvasImageNodeView): { x: number; y: number } {
  return {
    x: image.screenX,
    y: image.screenY + image.screenHeight / 2,
  };
}

export function imageOutputHandlePoint(image: CanvasImageNodeView): { x: number; y: number } {
  return {
    x: image.screenX + image.screenWidth,
    y: image.screenY + image.screenHeight / 2,
  };
}

export function videoInputHandlePoint(view: VideoNodeOverlayView): { x: number; y: number } {
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
  // Must match VideoNodeOverlay's positioning.
  void canvasWidth;
  void canvasHeight;
  const width = Math.max(240, Math.min(420, rawWidth));
  return { left: screenX, top: screenY, width, height: 220 };
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

export interface VideoEdgeRoute {
  start: EdgeAnchor;
  end: EdgeAnchor;
  label: ScreenPoint;
  path: string;
}

export function buildVideoEdgeRoute(
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

export function smoothEdgeRoute(start: EdgeAnchor, end: EdgeAnchor): VideoEdgeRoute {
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

export function videoLinkLabelText(label: VideoLinkLabelInfo, t?: Tr): string {
  const prefix = label.hasPromptField && label.order ? `${label.order} · ` : '';
  if (label.prompt.trim()) return `${prefix}${label.prompt.trim()}`;
  return label.hasPromptField ? `${prefix}${t?.('video.addShotDescription') ?? 'Add description'}` : label.plainLabel ?? t?.('video.sequence') ?? 'Sequence';
}
