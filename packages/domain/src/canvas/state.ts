// Creative Canvas — canonical board state + pure state helpers.
//
// Zero-dependency rule applies (see ./board). Everything here is pure and
// deterministic so it can be unit-tested and shared verbatim between the
// backend (authoritative merge) and the frontend (optimistic edits).

import type { CanvasEntitlement } from './board';
import {
  ASSET_BEARING_NODE_KINDS,
  type CanvasAssetRef,
  type CanvasGroup,
  type CanvasNode,
  type ImageCanvasNode,
} from './node';
import type { CanvasEdge } from './edge';
import type { CanvasActionType, CanvasPlaceholderMapping } from './action';

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasBoardState {
  schemaVersion: 1;
  /** Mirrors CanvasBoard.revision for client-side conflict checks. */
  boardRevision: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  groups: CanvasGroup[];
  viewport?: CanvasViewport;
  selection?: string[];
  metadata?: Record<string, unknown>;
}

/** V1 hard limits — enforced server-side, surfaced early in the UI. */
export const CANVAS_LIMITS = {
  maxNodes: 1000,
  maxStateBytes: 5 * 1024 * 1024,
  /** Show a soft warning once usage crosses this fraction of a limit. */
  warnFraction: 0.8,
} as const;

export const DEFAULT_GENERATED_NODE_SIZE = { width: 320, height: 320 } as const;
const GENERATED_NODE_GAP = 24;
const GENERATED_NODE_OFFSET = 48;

export function createEmptyCanvasBoardState(boardRevision = 1): CanvasBoardState {
  return {
    schemaVersion: 1,
    boardRevision,
    nodes: [],
    edges: [],
    groups: [],
  };
}

function toFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Coerce a possibly-partial state into a well-formed one: guarantees arrays
 * exist and node bounds are finite/non-negative-sized. Does NOT drop nodes to
 * satisfy limits — that is enforcement, not normalization.
 */
export function normalizeCanvasBoardState(
  state: Partial<CanvasBoardState> | null | undefined,
): CanvasBoardState {
  const source = state ?? {};
  const nodes = Array.isArray(source.nodes) ? source.nodes : [];
  const normalizedNodes = nodes.map((node) => ({
    ...node,
    x: toFinite(node.x, 0),
    y: toFinite(node.y, 0),
    width: Math.max(1, toFinite(node.width, DEFAULT_GENERATED_NODE_SIZE.width)),
    height: Math.max(1, toFinite(node.height, DEFAULT_GENERATED_NODE_SIZE.height)),
  }));

  return {
    schemaVersion: 1,
    boardRevision: Math.max(0, Math.trunc(toFinite(source.boardRevision, 0))),
    nodes: normalizedNodes,
    edges: Array.isArray(source.edges) ? source.edges : [],
    groups: Array.isArray(source.groups) ? source.groups : [],
    viewport: source.viewport,
    selection: Array.isArray(source.selection) ? source.selection : undefined,
    metadata: source.metadata,
  };
}

export interface CanvasNodeValidation {
  valid: boolean;
  issues: string[];
}

/** Structural validation of a single node (shape, not business rules). */
export function validateCanvasNode(node: CanvasNode): CanvasNodeValidation {
  const issues: string[] = [];
  if (!node.id) issues.push('missing_id');
  if (!node.kind) issues.push('missing_kind');
  if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) issues.push('invalid_position');
  if (!(node.width > 0) || !(node.height > 0)) issues.push('invalid_size');

  if ((node.kind === 'image' || node.kind === 'video' || node.kind === 'material') && !('assetRef' in node && node.assetRef)) {
    issues.push('missing_asset_ref');
  }
  if (node.kind === 'prompt' && !('prompt' in node && node.prompt)) {
    issues.push('missing_prompt');
  }

  return { valid: issues.length === 0, issues };
}

export interface CanvasAssetRefRecord {
  nodeId: string;
  refType: CanvasAssetRef['type'];
  refId?: string;
  storageKey?: string;
  externalUrl?: string;
}

/** Flatten every asset-bearing node into index rows for the refs table. */
export function extractCanvasAssetRefs(state: CanvasBoardState): CanvasAssetRefRecord[] {
  const records: CanvasAssetRefRecord[] = [];
  for (const node of state.nodes) {
    if (!ASSET_BEARING_NODE_KINDS.has(node.kind)) continue;
    const ref = (node as { assetRef?: CanvasAssetRef }).assetRef;
    if (!ref) continue;

    const record: CanvasAssetRefRecord = { nodeId: node.id, refType: ref.type };
    switch (ref.type) {
      case 'material_asset':
        record.refId = ref.materialId;
        if (ref.storageKey) record.storageKey = ref.storageKey;
        break;
      case 'image_generation':
      case 'video_generation':
        record.refId = ref.generationId;
        if (ref.storageKey) record.storageKey = ref.storageKey;
        break;
      case 'upload':
        record.storageKey = ref.storageKey;
        break;
      case 'external':
        record.externalUrl = ref.url;
        break;
    }
    records.push(record);
  }
  return records;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export interface Placement {
  x: number;
  y: number;
}

/**
 * Compute non-overlapping landing spots for `count` generated nodes, to the
 * right of the source selection's bounding box, stacked and collision-avoided.
 */
export function placeGeneratedNodesNearSource(
  state: CanvasBoardState,
  sourceNodeIds: string[],
  count: number,
  size: { width: number; height: number } = DEFAULT_GENERATED_NODE_SIZE,
): Placement[] {
  if (count <= 0) return [];

  const sourceIds = new Set(sourceNodeIds);
  const sources = state.nodes.filter((n) => sourceIds.has(n.id));

  let startX = GENERATED_NODE_OFFSET;
  let topY = 0;
  if (sources.length > 0) {
    const right = Math.max(...sources.map((n) => n.x + n.width));
    topY = Math.min(...sources.map((n) => n.y));
    startX = right + GENERATED_NODE_OFFSET;
  }

  const occupied: Rect[] = state.nodes.map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }));
  const placements: Placement[] = [];

  let cursorY = topY;
  for (let i = 0; i < count; i += 1) {
    let candidate: Rect = { x: startX, y: cursorY, width: size.width, height: size.height };
    while (occupied.some((rect) => rectsOverlap(candidate, rect))) {
      candidate = { ...candidate, y: candidate.y + size.height + GENERATED_NODE_GAP };
    }
    placements.push({ x: candidate.x, y: candidate.y });
    occupied.push(candidate);
    cursorY = candidate.y + size.height + GENERATED_NODE_GAP;
  }
  return placements;
}

/** Drop edges whose endpoints no longer exist. Returns a new state. */
export function removeOrphanCanvasEdges(state: CanvasBoardState): CanvasBoardState {
  const ids = new Set(state.nodes.map((n) => n.id));
  const edges = state.edges.filter((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId));
  if (edges.length === state.edges.length) return state;
  return { ...state, edges };
}

export type CanvasActionReasonCode =
  | 'membership_required'
  | 'needs_prompt'
  | 'needs_image'
  | 'needs_two_images'
  | 'needs_image_or_clip';

export interface CanvasActionAvailability {
  actionType: CanvasActionType;
  available: boolean;
  billable: boolean;
  /** Stable reason code; the UI maps it to an i18n string. */
  reason?: CanvasActionReasonCode;
}

/**
 * Resolve which selection-driven actions to offer. Applies a most-specific
 * requirement check per action, then the membership gate: billable actions
 * are disabled (not hidden) for non-members, with `membership_required`.
 */
export function resolveCanvasActionAvailability(
  state: CanvasBoardState,
  selectedNodeIds: string[],
  entitlement: CanvasEntitlement,
): CanvasActionAvailability[] {
  const selected = new Set(selectedNodeIds);
  const nodes = state.nodes.filter((n) => selected.has(n.id));
  const count = (kind: CanvasNode['kind']) => nodes.filter((n) => n.kind === kind).length;

  const prompts = count('prompt');
  const images = count('image');
  const clips = count('storyboardClip');

  const build = (
    actionType: CanvasActionType,
    meetsRequirement: boolean,
    requirementReason: CanvasActionReasonCode,
  ): CanvasActionAvailability => {
    if (!meetsRequirement) {
      return { actionType, available: false, billable: true, reason: requirementReason };
    }
    if (!entitlement.canGenerate) {
      return { actionType, available: false, billable: true, reason: 'membership_required' };
    }
    return { actionType, available: true, billable: true };
  };

  return [
    build('image-generate', prompts >= 1, 'needs_prompt'),
    build('image-edit', images >= 1, 'needs_image'),
    build('video-from-selection', images >= 1 || clips >= 1, 'needs_image_or_clip'),
    build('storyboard-from-selection', images >= 2, 'needs_two_images'),
  ];
}

export interface GeneratedImageResult {
  url: string;
  generationId: string;
  index?: number;
  prompt?: string | null;
  thumbnailUrl?: string | null;
}

export interface CreateGeneratedImageNodesInput {
  results: GeneratedImageResult[];
  placements: Placement[];
  sourceNodeIds: string[];
  createdAt: string;
  /** Backend supplies id generation; the domain stays pure/deterministic. */
  makeNodeId: (index: number) => string;
  makeEdgeId: (index: number) => string;
  size?: { width: number; height: number };
}

/**
 * Turn a generation result into image nodes plus `generatedFrom` edges back
 * to every source node. Positions come from `placeGeneratedNodesNearSource`.
 */
export function createGeneratedImageNodes(
  input: CreateGeneratedImageNodesInput,
): { nodes: ImageCanvasNode[]; edges: CanvasEdge[] } {
  const size = input.size ?? DEFAULT_GENERATED_NODE_SIZE;
  const nodes: ImageCanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  input.results.forEach((result, i) => {
    const placement = input.placements[i] ?? { x: 0, y: i * (size.height + GENERATED_NODE_GAP) };
    const nodeId = input.makeNodeId(i);
    nodes.push({
      id: nodeId,
      kind: 'image',
      x: placement.x,
      y: placement.y,
      width: size.width,
      height: size.height,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      assetRef: {
        type: 'image_generation',
        generationId: result.generationId,
        index: result.index,
      },
      resolvedUrl: result.url,
      resolvedThumbnailUrl: result.thumbnailUrl ?? null,
      prompt: result.prompt ?? null,
    });
    input.sourceNodeIds.forEach((sourceId, j) => {
      edges.push({
        id: input.makeEdgeId(i * 100 + j),
        kind: 'generatedFrom',
        fromNodeId: sourceId,
        toNodeId: nodeId,
      });
    });
  });

  return { nodes, edges };
}

export interface CanvasSelectionContext {
  prompts: Array<{ id: string; prompt: string }>;
  images: Array<{ id: string; assetRef: CanvasAssetRef; resolvedUrl?: string | null }>;
  storyboardClipIds: string[];
  otherNodeIds: string[];
}

/** Build a structured context for AI / action assembly from a selection. */
export function buildCanvasSelectionContext(
  state: CanvasBoardState,
  selectedNodeIds: string[],
): CanvasSelectionContext {
  const selected = new Set(selectedNodeIds);
  const ctx: CanvasSelectionContext = {
    prompts: [],
    images: [],
    storyboardClipIds: [],
    otherNodeIds: [],
  };
  for (const node of state.nodes) {
    if (!selected.has(node.id)) continue;
    if (node.kind === 'prompt') {
      ctx.prompts.push({ id: node.id, prompt: node.prompt });
    } else if (node.kind === 'image') {
      ctx.images.push({ id: node.id, assetRef: node.assetRef, resolvedUrl: node.resolvedUrl });
    } else if (node.kind === 'storyboardClip') {
      ctx.storyboardClipIds.push(node.id);
    } else {
      ctx.otherNodeIds.push(node.id);
    }
  }
  return ctx;
}

/**
 * Server-authoritative merge: append generated nodes/edges and replace the
 * client placeholder (matched by `clientPlaceholderId`, never by position).
 * Returns the new state with a bumped `boardRevision`.
 */
export function mergeGeneratedResult(
  state: CanvasBoardState,
  input: {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    clientPlaceholderId?: string;
    boardRevision: number;
  },
): { state: CanvasBoardState; mapping?: CanvasPlaceholderMapping } {
  let nodes = state.nodes;
  let mapping: CanvasPlaceholderMapping | undefined;

  if (input.clientPlaceholderId) {
    const placeholder = state.nodes.find(
      (n) => n.kind === 'generationTask' && n.clientPlaceholderId === input.clientPlaceholderId,
    );
    if (placeholder && input.nodes[0]) {
      mapping = {
        clientPlaceholderId: input.clientPlaceholderId,
        resultNodeId: input.nodes[0].id,
        replaceNodeId: placeholder.id,
      };
      nodes = state.nodes.filter((n) => n.id !== placeholder.id);
    }
  }

  return {
    state: {
      ...state,
      boardRevision: input.boardRevision,
      nodes: [...nodes, ...input.nodes],
      edges: [...state.edges, ...input.edges],
    },
    mapping,
  };
}

export interface CanvasStateSize {
  bytes: number;
  nodes: number;
  overLimit: boolean;
  nearLimit: boolean;
}

/** Measure a state against CANVAS_LIMITS. Used by the server-side guard. */
export function measureCanvasState(state: CanvasBoardState): CanvasStateSize {
  const bytes = new TextEncoder().encode(JSON.stringify(state)).length;
  const nodes = state.nodes.length;
  const overLimit = bytes > CANVAS_LIMITS.maxStateBytes || nodes > CANVAS_LIMITS.maxNodes;
  const nearLimit =
    bytes >= CANVAS_LIMITS.maxStateBytes * CANVAS_LIMITS.warnFraction ||
    nodes >= CANVAS_LIMITS.maxNodes * CANVAS_LIMITS.warnFraction;
  return { bytes, nodes, overLimit, nearLimit };
}
