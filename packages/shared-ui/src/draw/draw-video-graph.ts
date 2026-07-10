// Reads the canvas topology around a video node and classifies it into a
// video-generation composition. The v5 semantics are intentionally explicit:
// images connected only to the node/tray are inputs, image-image links carry
// time semantics, and labelled image-image links are storyboard shots.

import type { DrawElement } from './draw-scene-mapper';

export const VIDEO_NODE_KIND = 'videoNode';
export const VIDEO_LINK_KIND = 'videoLink';

export type VideoCompositionMode =
  | 'text_to_video'
  | 'reference'
  | 'image_to_video'
  | 'first_last_frame'
  | 'storyboard';

export interface VideoCompositionIssue {
  code: string;
  level: 'warning' | 'blocking';
  elementIds: string[];
  message: string;
}

export interface VideoCompositionShot {
  prompt: string;
  fromElementId: string;
  toElementId: string;
  linkElementId: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
}

export type VideoShot = VideoCompositionShot;

export interface VideoComposition {
  targetVideoNodeId: string;
  mode: VideoCompositionMode;
  autoMode: VideoCompositionMode;
  userMode?: VideoCompositionMode;
  prompt: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls: string[];
  shots: VideoCompositionShot[];
  shotOrder: string[];
  issues: VideoCompositionIssue[];
  sourceElementIds: string[];
  /** Backward-compatible summary for older UI call sites. */
  warnings: string[];
}

export interface VideoNodeData {
  kind: typeof VIDEO_NODE_KIND;
  projectId?: string;
  prompt?: string;
  userMode?: VideoCompositionMode | null;
  inputElementIds?: string[];
  trayOrder?: string[];
  firstFrameElementId?: string;
  lastFrameElementId?: string;
  referenceElementIds?: string[];
  shotOrder?: string[];
  params?: { modelConfigId?: string; ratio?: string; duration?: number; resolution?: string };
  generation?: { status?: string; generationId?: string; videoUrl?: string; thumbnailUrl?: string; error?: string };
}

export interface VideoLinkCustomData {
  kind: typeof VIDEO_LINK_KIND;
  prompt?: string;
  role?: 'input' | 'sequence';
}

interface Edge {
  id: string;
  from: string;
  to: string;
  prompt: string | null;
  hasPrompt: boolean;
}

interface ImageRef {
  id: string;
  url: string;
}

function isDeleted(el: DrawElement | undefined): boolean {
  return Boolean(el?.isDeleted);
}

function isImage(el: DrawElement | undefined): el is DrawElement {
  return el !== undefined && el.type === 'image' && !isDeleted(el);
}

function isText(el: DrawElement | undefined): el is DrawElement {
  return el !== undefined && el.type === 'text' && !isDeleted(el);
}

function isVideoNode(el: DrawElement | undefined): boolean {
  return Boolean(el) && !isDeleted(el) && el?.customData?.kind === VIDEO_NODE_KIND;
}

function assetUrlOf(el: DrawElement | undefined): string | null {
  const url = el?.customData?.assetUrl;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

export function bindingId(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const id = (value as { elementId?: unknown }).elementId;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return null;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function customDataOf(el: DrawElement | undefined): Record<string, unknown> {
  return el?.customData && typeof el.customData === 'object' ? el.customData : {};
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function maybeMode(value: unknown): VideoCompositionMode | undefined {
  return value === 'text_to_video'
    || value === 'reference'
    || value === 'image_to_video'
    || value === 'first_last_frame'
    || value === 'storyboard'
    ? value
    : undefined;
}

function readVideoNodeData(el: DrawElement | undefined): Partial<VideoNodeData> {
  const data = customDataOf(el);
  return {
    kind: VIDEO_NODE_KIND,
    projectId: typeof data.projectId === 'string' ? data.projectId : undefined,
    prompt: typeof data.prompt === 'string' ? data.prompt : undefined,
    userMode: data.userMode === null ? null : maybeMode(data.userMode),
    inputElementIds: stringArray(data.inputElementIds),
    trayOrder: stringArray(data.trayOrder),
    firstFrameElementId: typeof data.firstFrameElementId === 'string' ? data.firstFrameElementId : undefined,
    lastFrameElementId: typeof data.lastFrameElementId === 'string' ? data.lastFrameElementId : undefined,
    referenceElementIds: stringArray(data.referenceElementIds),
    shotOrder: stringArray(data.shotOrder),
  };
}

function collectEdges(elements: readonly DrawElement[]): Edge[] {
  const edges: Edge[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow' || isDeleted(el)) continue;
    const from = bindingId(el.startBinding);
    const to = bindingId(el.endBinding);
    if (!from || !to || from === to) continue;

    const data = customDataOf(el);
    const hasPrompt = hasOwn(data, 'prompt');
    const rawPrompt = data.prompt;
    edges.push({
      id: el.id,
      from,
      to,
      hasPrompt,
      prompt: typeof rawPrompt === 'string' ? rawPrompt.trim() : null,
    });
  }
  return edges;
}

function addUnique(target: string[], id: string | undefined): void {
  if (id && !target.includes(id)) target.push(id);
}

export function uniqueStrings(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) addUnique(out, id);
  return out;
}

function collectRouteIds(
  targetVideoNodeId: string,
  edges: readonly Edge[],
  byId: Map<string, DrawElement>,
): Set<string> {
  const seen = new Set<string>([targetVideoNodeId]);
  const stack = [targetVideoNodeId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const edge of edges) {
      if (edge.to !== current) continue;
      if (edge.from !== targetVideoNodeId && isVideoNode(byId.get(edge.from))) continue;
      if (!seen.has(edge.from)) {
        seen.add(edge.from);
        stack.push(edge.from);
      }
    }
  }
  return seen;
}

function orderByPreference(ids: readonly string[], preferred: readonly string[], elements: readonly DrawElement[]): string[] {
  const remaining = new Set(ids);
  const out: string[] = [];
  for (const id of preferred) {
    if (remaining.delete(id)) out.push(id);
  }
  for (const el of elements) {
    if (remaining.delete(el.id)) out.push(el.id);
  }
  for (const id of remaining) out.push(id);
  return out;
}

function spatialImageOrder(ids: readonly string[], byId: Map<string, DrawElement>): string[] {
  return [...ids].sort((a, b) => {
    const left = byId.get(a);
    const right = byId.get(b);
    const lx = typeof left?.x === 'number' ? left.x : 0;
    const rx = typeof right?.x === 'number' ? right.x : 0;
    if (lx !== rx) return lx - rx;
    const ly = typeof left?.y === 'number' ? left.y : 0;
    const ry = typeof right?.y === 'number' ? right.y : 0;
    return ly - ry;
  });
}

function orderedImages(ids: readonly string[], byId: Map<string, DrawElement>): ImageRef[] {
  return ids
    .map((id) => ({ id, url: assetUrlOf(byId.get(id)) }))
    .filter((item): item is ImageRef => typeof item.url === 'string' && item.url.length > 0);
}

function isStoryboardEdge(edge: Edge): boolean {
  return edge.hasPrompt;
}

function textContentOf(el: DrawElement | undefined): string {
  const value = el?.text;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Fold `image → text → image` chains into storyboard shot edges (compat path):
 * the text node between two images becomes that shot's prompt. Only folds when
 * the text sits between exactly one upstream and one downstream image, so the
 * shot is unambiguous; otherwise the text node stays a compatibility warning.
 */
function deriveTextNodeShotEdges(
  edges: readonly Edge[],
  byId: Map<string, DrawElement>,
  usableImageIds: ReadonlySet<string>,
  textIds: readonly string[],
): { shotEdges: Edge[]; foldedTextIds: Set<string> } {
  const shotEdges: Edge[] = [];
  const foldedTextIds = new Set<string>();
  for (const textId of textIds) {
    const incoming = edges.filter((edge) => edge.to === textId && usableImageIds.has(edge.from)).map((edge) => edge.from);
    const outgoing = edges.filter((edge) => edge.from === textId && usableImageIds.has(edge.to)).map((edge) => edge.to);
    if (incoming.length !== 1 || outgoing.length !== 1 || incoming[0] === outgoing[0]) continue;
    const prompt = textContentOf(byId.get(textId));
    shotEdges.push({ id: textId, from: incoming[0], to: outgoing[0], prompt: prompt || null, hasPrompt: true });
    foldedTextIds.add(textId);
  }
  return { shotEdges, foldedTextIds };
}

function orderShotEdges(shotEdges: readonly Edge[], shotOrder: readonly string[]): Edge[] {
  if (shotEdges.length <= 1) return [...shotEdges];
  const byId = new Map(shotEdges.map((edge) => [edge.id, edge] as const));
  const ordered: Edge[] = [];
  const used = new Set<string>();

  for (const id of shotOrder) {
    const edge = byId.get(id);
    if (edge && !used.has(edge.id)) {
      ordered.push(edge);
      used.add(edge.id);
    }
  }
  if (ordered.length > 0) {
    for (const edge of shotEdges) {
      if (!used.has(edge.id)) ordered.push(edge);
    }
    return ordered;
  }

  const incoming = new Set(shotEdges.map((edge) => edge.to));
  const outgoing = new Map<string, Edge[]>();
  for (const edge of shotEdges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }

  const heads = shotEdges.filter((edge) => !incoming.has(edge.from));
  const starts = heads.length > 0 ? heads : [shotEdges[0]];
  for (const start of starts) {
    let edge: Edge | undefined = start;
    while (edge && !used.has(edge.id)) {
      ordered.push(edge);
      used.add(edge.id);
      edge = outgoing.get(edge.to)?.find((next) => !used.has(next.id));
    }
  }
  for (const edge of shotEdges) {
    if (!used.has(edge.id)) ordered.push(edge);
  }
  return ordered;
}

function reachableVideoSinks(startId: string, edges: readonly Edge[], byId: Map<string, DrawElement>): Set<string> {
  const sinks = new Set<string>();
  const seen = new Set<string>([startId]);
  const stack = [startId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const edge of edges) {
      if (edge.from !== current) continue;
      if (isVideoNode(byId.get(edge.to))) {
        sinks.add(edge.to);
        continue;
      }
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        stack.push(edge.to);
      }
    }
  }
  return sinks;
}

function hasShotCycle(shotEdges: readonly Edge[]): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of shotEdges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge.to);
    outgoing.set(edge.from, list);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of outgoing.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  return shotEdges.some((edge) => visit(edge.from));
}

function issue(
  code: string,
  level: VideoCompositionIssue['level'],
  elementIds: string[],
  message: string,
): VideoCompositionIssue {
  return { code, level, elementIds: uniqueStrings(elementIds), message };
}

function fallbackComposition(
  videoNodeId: string,
  issueItem: VideoCompositionIssue,
): VideoComposition {
  return {
    targetVideoNodeId: videoNodeId,
    mode: 'text_to_video',
    autoMode: 'text_to_video',
    prompt: '',
    referenceUrls: [],
    shots: [],
    shotOrder: [],
    issues: [issueItem],
    sourceElementIds: [videoNodeId],
    warnings: issueItem.level === 'warning' ? [issueItem.code] : [],
  };
}

export function readVideoComposition(
  elements: readonly DrawElement[],
  videoNodeId: string,
): VideoComposition {
  const byId = new Map(elements.filter((el) => !isDeleted(el)).map((el) => [el.id, el] as const));
  const target = byId.get(videoNodeId);
  if (!target) {
    return fallbackComposition(
      videoNodeId,
      issue('missing-video-node', 'blocking', [videoNodeId], 'Target video node was not found.'),
    );
  }

  const nodeData = readVideoNodeData(target);
  const edges = collectEdges(elements);
  const routeIds = collectRouteIds(videoNodeId, edges, byId);
  const explicitInputIds = uniqueStrings([
    ...(nodeData.inputElementIds ?? []),
    ...(nodeData.referenceElementIds ?? []),
    nodeData.firstFrameElementId ?? '',
    nodeData.lastFrameElementId ?? '',
  ].filter(Boolean));
  for (const id of explicitInputIds) {
    if (byId.has(id)) routeIds.add(id);
  }

  const preferredIds = uniqueStrings([
    ...(nodeData.trayOrder ?? []),
    ...(nodeData.inputElementIds ?? []),
    ...(nodeData.referenceElementIds ?? []),
  ]);
  const imageIds = orderByPreference(
    [...routeIds].filter((id) => isImage(byId.get(id))),
    preferredIds,
    elements,
  );
  const textIds = [...routeIds].filter((id) => isText(byId.get(id)));
  const images = orderedImages(imageIds, byId);
  const usableImageIds = new Set(images.map((item) => item.id));
  const sequenceEdges = edges.filter((edge) => usableImageIds.has(edge.from) && usableImageIds.has(edge.to));
  // Storyboard shots come from labelled image↔image lines AND, for compat, from
  // image→text→image chains (each text node folds into that shot's prompt).
  const textShots = deriveTextNodeShotEdges(edges, byId, usableImageIds, textIds);
  const shotEdges = [...sequenceEdges.filter(isStoryboardEdge), ...textShots.shotEdges];
  const unlabelledSequenceEdges = sequenceEdges.filter((edge) => !isStoryboardEdge(edge));
  const issues: VideoCompositionIssue[] = [];

  let autoMode: VideoCompositionMode;
  if (shotEdges.length > 0) {
    autoMode = 'storyboard';
  } else if (images.length === 0) {
    autoMode = 'text_to_video';
  } else if (images.length === 1) {
    autoMode = 'image_to_video';
  } else if (images.length === 2 && unlabelledSequenceEdges.length > 0) {
    autoMode = 'first_last_frame';
  } else {
    autoMode = 'reference';
  }

  // Canvas composition is topology-driven: no line means reference, an
  // unlabelled image-image line means first/last, and a labelled line means a
  // storyboard shot. Older boards may still carry userMode, but the canvas UI
  // should not let stale manual mode override the actual graph.
  const userMode = undefined;
  const mode = autoMode;
  const prompt = (nodeData.prompt ?? '').trim();

  if (!prompt) {
    issues.push(issue(
      'empty-prompt',
      mode === 'text_to_video' ? 'blocking' : 'warning',
      [videoNodeId],
      mode === 'text_to_video' ? 'Text-to-video requires a prompt.' : 'This video node has no prompt, but image materials can still be used.',
    ));
  }

  const unfoldedTextIds = textIds.filter((id) => !textShots.foldedTextIds.has(id));
  if (unfoldedTextIds.length > 0) {
    issues.push(issue(
      'text-node-compatibility',
      'warning',
      unfoldedTextIds,
      'A text node could not be assigned uniquely between two images, so it was not used in the storyboard. Describe the main storyboard path with image-to-image links.',
    ));
  }

  let firstFrameUrl: string | undefined;
  let lastFrameUrl: string | undefined;
  let referenceUrls: string[] = [];
  let shots: VideoCompositionShot[] = [];
  let shotOrder = nodeData.shotOrder ?? [];

  if (mode === 'image_to_video') {
    firstFrameUrl = assetUrlOf(byId.get(nodeData.firstFrameElementId ?? '')) ?? images[0]?.url;
    if (!firstFrameUrl) {
      issues.push(issue('missing-first-frame', 'blocking', [videoNodeId], 'Image-to-video requires a first-frame image.'));
    }
  }

  if (mode === 'reference') {
    const referenceIds = (nodeData.referenceElementIds?.length ?? 0) > 0 ? nodeData.referenceElementIds ?? [] : imageIds;
    referenceUrls = orderedImages(referenceIds, byId).map((item) => item.url);
    if (referenceUrls.length === 0) {
      issues.push(issue('missing-reference-images', 'blocking', [videoNodeId], 'Reference image mode requires at least one image.'));
    }
  }

  if (mode === 'first_last_frame') {
    const explicitFirst = assetUrlOf(byId.get(nodeData.firstFrameElementId ?? ''));
    const explicitLast = assetUrlOf(byId.get(nodeData.lastFrameElementId ?? ''));
    if (explicitFirst && explicitLast) {
      firstFrameUrl = explicitFirst;
      lastFrameUrl = explicitLast;
    } else {
      const sequence = unlabelledSequenceEdges[0];
      if (sequence) {
        firstFrameUrl = assetUrlOf(byId.get(sequence.from)) ?? undefined;
        lastFrameUrl = assetUrlOf(byId.get(sequence.to)) ?? undefined;
      } else {
        const spatial = spatialImageOrder(imageIds, byId);
        firstFrameUrl = assetUrlOf(byId.get(spatial[0])) ?? undefined;
        lastFrameUrl = assetUrlOf(byId.get(spatial[1])) ?? undefined;
        issues.push(issue(
          'missing-first-last-link',
          'blocking',
          [videoNodeId, ...spatial.slice(0, 2)],
          'First/last frame mode requires an image-to-image link without a description.',
        ));
      }
    }
  }

  if (mode === 'storyboard') {
    const orderedEdges = orderShotEdges(shotEdges, shotOrder);
    shotOrder = orderedEdges.map((edge) => edge.id);
    shots = orderedEdges.map((edge) => ({
      prompt: edge.prompt ?? '',
      fromElementId: edge.from,
      toElementId: edge.to,
      linkElementId: edge.id,
      firstFrameUrl: assetUrlOf(byId.get(edge.from)) ?? undefined,
      lastFrameUrl: assetUrlOf(byId.get(edge.to)) ?? undefined,
    }));

    if (shots.length === 0) {
      issues.push(issue('storyboard-no-shots', 'blocking', [videoNodeId], 'Storyboard mode requires at least one described image-to-image link.'));
    }

    for (const shot of shots) {
      if (!shot.prompt) {
        issues.push(issue('empty-shot-prompt', 'blocking', [shot.linkElementId], 'Storyboard links require descriptions.'));
      }
    }

    const outgoingCounts = new Map<string, number>();
    const incomingCounts = new Map<string, number>();
    for (const edge of shotEdges) {
      outgoingCounts.set(edge.from, (outgoingCounts.get(edge.from) ?? 0) + 1);
      incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
    }
    const branchIds = uniqueStrings([
      ...[...outgoingCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
      ...[...incomingCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
    ]);
    if (branchIds.length > 0) {
      issues.push(issue('storyboard-branch', 'blocking', branchIds, 'The storyboard has branches. Confirm or split it into a linear timeline.'));
    }
    if (hasShotCycle(shotEdges)) {
      issues.push(issue('storyboard-cycle', 'blocking', shotEdges.map((edge) => edge.id), 'Storyboard links form a cycle. Break the cycle before generating.'));
    }

    for (const edge of shotEdges) {
      const sinks = reachableVideoSinks(edge.to, edges, byId);
      if (sinks.size === 0) {
        issues.push(issue('shot-link-dangling', 'warning', [edge.id], 'This storyboard link does not flow into any video node, so it will not be generated.'));
      } else if (!sinks.has(videoNodeId) || sinks.size > 1) {
        issues.push(issue(
          'shot-link-multi-sink',
          'blocking',
          [edge.id, ...sinks],
          'This storyboard link reaches multiple downstream video nodes. Copy or split it, or explicitly include it in one node timeline.',
        ));
      }
    }
  }

  const routeEdgeIds = edges
    .filter((edge) => {
      if (edge.to === videoNodeId && routeIds.has(edge.from)) return true;
      return routeIds.has(edge.from) && routeIds.has(edge.to);
    })
    .map((edge) => edge.id);
  const sourceElementIds = uniqueStrings([
    videoNodeId,
    ...imageIds,
    ...textIds,
    ...routeEdgeIds,
    ...shotOrder,
  ]);

  return {
    targetVideoNodeId: videoNodeId,
    mode,
    autoMode,
    userMode,
    prompt,
    firstFrameUrl,
    lastFrameUrl,
    referenceUrls,
    shots,
    shotOrder,
    issues,
    sourceElementIds,
    warnings: issues.filter((item) => item.level === 'warning').map((item) => item.code),
  };
}
