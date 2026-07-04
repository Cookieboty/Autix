// Reads the canvas topology around a 🎬 video node and classifies it into a
// video-generation spec. The whole point is that the *structure* of the
// connections decides the mode — there is no separate "video mode" toggle:
//
//   • N images each connected into the node (parallel, no image↔image links)
//       → reference images (multiple → multiple references)
//   • exactly 2 images linked to *each other* (A → B)
//       → first/last frame; arrow direction sets order (A first, B last)
//   • 1 image linked in
//       → image-to-video (that image is the first frame)
//   • an image→text→image→text… chain
//       → storyboard: every image→text→image triple is one shot
//         (first frame, last frame, text as the shot prompt), chained
//   • nothing but the node
//       → text-to-video (prompt only)
//
// This module is pure so the semantics can be locked down with unit tests,
// independent of Excalidraw and the network.

import type { DrawElement } from './draw-scene-mapper';

export const VIDEO_NODE_KIND = 'videoNode';
export const VIDEO_LINK_KIND = 'videoLink';

export type VideoCompositionMode =
  | 'text_to_video'
  | 'reference'
  | 'image_to_video'
  | 'first_last_frame'
  | 'storyboard';

export interface VideoShot {
  prompt: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
}

export interface VideoComposition {
  mode: VideoCompositionMode;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls: string[];
  shots: VideoShot[];
  /** Non-fatal notes about ambiguous topology, surfaced to the user. */
  warnings: string[];
}

interface Edge {
  from: string;
  to: string;
}

function isImage(el: DrawElement): boolean {
  return el.type === 'image' && !el.isDeleted;
}

function isText(el: DrawElement): boolean {
  return el.type === 'text' && !el.isDeleted;
}

function assetUrlOf(el: DrawElement): string | null {
  const url = el.customData?.assetUrl;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

function textOf(el: DrawElement): string {
  return typeof el.text === 'string' ? el.text.trim() : '';
}

function bindingId(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const id = (value as { elementId?: unknown }).elementId;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return null;
}

/**
 * Collect the bound arrows as directed edges. We accept any bound arrow (drawn
 * with the native arrow tool) so the feature works before dedicated connection
 * ports exist; a `customData.kind` of VIDEO_LINK_KIND is honoured but never
 * required.
 */
function collectEdges(elements: readonly DrawElement[]): Edge[] {
  const edges: Edge[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow' || el.isDeleted) continue;
    const from = bindingId(el.startBinding);
    const to = bindingId(el.endBinding);
    if (from && to && from !== to) edges.push({ from, to });
  }
  return edges;
}

/** Undirected reachable set from the node id. */
function componentOf(nodeId: string, edges: readonly Edge[]): Set<string> {
  const adj = new Map<string, string[]>();
  for (const { from, to } of edges) {
    (adj.get(from) ?? adj.set(from, []).get(from)!).push(to);
    (adj.get(to) ?? adj.set(to, []).get(to)!).push(from);
  }
  const seen = new Set<string>([nodeId]);
  const stack = [nodeId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}

/**
 * Order the content nodes (images + texts, excluding the video node) along the
 * directed chain: start from the source that has no incoming content edge and
 * follow outgoing edges. Best-effort for linear graphs; branches fall back to
 * insertion order.
 */
function orderChain(
  contentIds: Set<string>,
  edges: readonly Edge[],
): string[] {
  const contentEdges = edges.filter((e) => contentIds.has(e.from) && contentIds.has(e.to));
  const next = new Map<string, string>();
  const indeg = new Map<string, number>();
  for (const id of contentIds) indeg.set(id, 0);
  for (const { from, to } of contentEdges) {
    next.set(from, to);
    indeg.set(to, (indeg.get(to) ?? 0) + 1);
  }
  const head = [...contentIds].find((id) => (indeg.get(id) ?? 0) === 0) ?? [...contentIds][0];
  const ordered: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = head;
  while (cur && contentIds.has(cur) && !seen.has(cur)) {
    ordered.push(cur);
    seen.add(cur);
    cur = next.get(cur);
  }
  // Append any nodes not reached by the linear walk (branchy graphs).
  for (const id of contentIds) if (!seen.has(id)) ordered.push(id);
  return ordered;
}

/**
 * Classify the topology around `videoNodeId` into a generation spec.
 * `elements` is the full Excalidraw scene.
 */
export function readVideoComposition(
  elements: readonly DrawElement[],
  videoNodeId: string,
): VideoComposition {
  const byId = new Map(elements.map((el) => [el.id, el] as const));
  const edges = collectEdges(elements);
  const component = componentOf(videoNodeId, edges);

  const contentIds = new Set<string>();
  for (const id of component) {
    if (id === videoNodeId) continue;
    const el = byId.get(id);
    if (el && (isImage(el) || isText(el))) contentIds.add(id);
  }

  const imageIds = [...contentIds].filter((id) => isImage(byId.get(id)!));
  const textIds = [...contentIds].filter((id) => isText(byId.get(id)!));
  const warnings: string[] = [];

  const images = imageIds
    .map((id) => ({ id, url: assetUrlOf(byId.get(id)!) }))
    .filter((item): item is { id: string; url: string } => Boolean(item.url));
  const texts = textIds
    .map((id) => ({ id, text: textOf(byId.get(id)!) }))
    .filter((item) => item.text.length > 0);

  // Storyboard: images interleaved with text prompts.
  if (images.length > 0 && texts.length > 0) {
    const ordered = orderChain(contentIds, edges);
    const shots: VideoShot[] = [];
    for (let i = 0; i < ordered.length; i += 1) {
      const el = byId.get(ordered[i]);
      if (!el || !isText(el)) continue;
      const prompt = textOf(el);
      if (!prompt) continue;
      const prevImg = findAdjacentImage(ordered, i, -1, byId);
      const nextImg = findAdjacentImage(ordered, i, +1, byId);
      shots.push({
        prompt,
        firstFrameUrl: prevImg ?? nextImg ?? undefined,
        lastFrameUrl: prevImg && nextImg ? nextImg : undefined,
      });
    }
    if (shots.length > 0) {
      return { mode: 'storyboard', referenceUrls: [], shots, warnings };
    }
    warnings.push('storyboard-no-shots');
  }

  // No images: text-to-video.
  if (images.length === 0) {
    return { mode: 'text_to_video', referenceUrls: [], shots: [], warnings };
  }

  // Single image linked in → image-to-video (first frame).
  if (images.length === 1) {
    return { mode: 'image_to_video', firstFrameUrl: images[0].url, referenceUrls: [], shots: [], warnings };
  }

  // Two images linked to *each other* → first/last frame by arrow direction.
  const imageIdSet = new Set(images.map((i) => i.id));
  const imageEdge = edges.find((e) => imageIdSet.has(e.from) && imageIdSet.has(e.to));
  if (images.length === 2 && imageEdge) {
    const first = images.find((i) => i.id === imageEdge.from)!;
    const last = images.find((i) => i.id === imageEdge.to)!;
    return {
      mode: 'first_last_frame',
      firstFrameUrl: first.url,
      lastFrameUrl: last.url,
      referenceUrls: [],
      shots: [],
      warnings,
    };
  }

  // Otherwise: parallel images (fan-in) → multiple references.
  return { mode: 'reference', referenceUrls: images.map((i) => i.url), shots: [], warnings };
}

function findAdjacentImage(
  ordered: readonly string[],
  index: number,
  dir: 1 | -1,
  byId: Map<string, DrawElement>,
): string | undefined {
  for (let i = index + dir; i >= 0 && i < ordered.length; i += dir) {
    const el = byId.get(ordered[i]);
    if (el && isImage(el)) return assetUrlOf(el) ?? undefined;
  }
  return undefined;
}
