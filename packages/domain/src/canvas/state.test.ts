import { describe, expect, it } from 'vitest';
import { CANVAS_FREE_TIER_ENTITLEMENT, type CanvasEntitlement } from './board';
import type { CanvasNode, ImageCanvasNode, PromptCanvasNode } from './node';
import type { CanvasEdge } from './edge';
import type { GenerationTaskCanvasNode } from './node';
import {
  CANVAS_LIMITS,
  type CanvasBoardState,
  buildCanvasSelectionContext,
  createEmptyCanvasBoardState,
  createGeneratedImageNodes,
  extractCanvasAssetRefs,
  measureCanvasState,
  mergeGeneratedResult,
  normalizeCanvasBoardState,
  placeGeneratedNodesNearSource,
  removeOrphanCanvasEdges,
  resolveCanvasActionAvailability,
  validateCanvasNode,
} from './state';

const MEMBER: CanvasEntitlement = {
  canView: true,
  canEditLayout: true,
  canSave: true,
  canCreateBoard: true,
  canGenerate: true,
  canUploadMaterial: true,
  canPublish: false,
};

const imageNode = (id: string, over: Partial<ImageCanvasNode> = {}): ImageCanvasNode => ({
  id,
  kind: 'image',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  createdAt: 't',
  updatedAt: 't',
  assetRef: { type: 'image_generation', generationId: `gen-${id}`, index: 0 },
  ...over,
});

const promptNode = (id: string, over: Partial<PromptCanvasNode> = {}): PromptCanvasNode => ({
  id,
  kind: 'prompt',
  x: 0,
  y: 0,
  width: 200,
  height: 80,
  createdAt: 't',
  updatedAt: 't',
  prompt: 'a cat',
  ...over,
});

const stateWith = (nodes: CanvasNode[], edges: CanvasEdge[] = []): CanvasBoardState => ({
  ...createEmptyCanvasBoardState(3),
  nodes,
  edges,
});

describe('normalizeCanvasBoardState', () => {
  it('fills missing collections and preserves revision', () => {
    const s = normalizeCanvasBoardState({ boardRevision: 7 } as Partial<CanvasBoardState>);
    expect(s.nodes).toEqual([]);
    expect(s.edges).toEqual([]);
    expect(s.groups).toEqual([]);
    expect(s.boardRevision).toBe(7);
    expect(s.schemaVersion).toBe(1);
  });

  it('repairs non-finite bounds and clamps sizes to >= 1', () => {
    const broken = imageNode('a', { x: Number.NaN, width: 0, height: -5 });
    const s = normalizeCanvasBoardState({ boardRevision: 1, nodes: [broken] } as Partial<CanvasBoardState>);
    expect(s.nodes[0].x).toBe(0);
    expect(s.nodes[0].width).toBeGreaterThanOrEqual(1);
    expect(s.nodes[0].height).toBeGreaterThanOrEqual(1);
  });
});

describe('validateCanvasNode', () => {
  it('accepts a well-formed image node', () => {
    expect(validateCanvasNode(imageNode('a')).valid).toBe(true);
  });

  it('flags an image node without an asset ref', () => {
    const bad = { ...imageNode('a'), assetRef: undefined } as unknown as ImageCanvasNode;
    const res = validateCanvasNode(bad);
    expect(res.valid).toBe(false);
    expect(res.issues).toContain('missing_asset_ref');
  });

  it('flags a prompt node with an empty prompt', () => {
    const res = validateCanvasNode(promptNode('p', { prompt: '' }));
    expect(res.issues).toContain('missing_prompt');
  });
});

describe('extractCanvasAssetRefs', () => {
  it('emits one row per asset-bearing node with the right ref id', () => {
    const state = stateWith([imageNode('a'), promptNode('p')]);
    const refs = extractCanvasAssetRefs(state);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ nodeId: 'a', refType: 'image_generation', refId: 'gen-a' });
  });
});

describe('placeGeneratedNodesNearSource', () => {
  it('places results to the right of the source and avoids overlap', () => {
    const source = imageNode('src', { x: 0, y: 0, width: 100, height: 100 });
    const state = stateWith([source]);
    const spots = placeGeneratedNodesNearSource(state, ['src'], 2, { width: 100, height: 100 });
    expect(spots).toHaveLength(2);
    expect(spots[0].x).toBeGreaterThan(source.x + source.width);
    // Two stacked results must not share a Y.
    expect(spots[0].y).not.toBe(spots[1].y);
  });

  it('returns empty for a non-positive count', () => {
    expect(placeGeneratedNodesNearSource(stateWith([]), [], 0)).toEqual([]);
  });
});

describe('removeOrphanCanvasEdges', () => {
  it('drops edges whose endpoints are gone', () => {
    const edges: CanvasEdge[] = [
      { id: 'e1', kind: 'generatedFrom', fromNodeId: 'a', toNodeId: 'b' },
      { id: 'e2', kind: 'reference', fromNodeId: 'a', toNodeId: 'missing' },
    ];
    const state = stateWith([imageNode('a'), imageNode('b')], edges);
    const cleaned = removeOrphanCanvasEdges(state);
    expect(cleaned.edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('returns the same reference when nothing is orphaned', () => {
    const state = stateWith([imageNode('a')], []);
    expect(removeOrphanCanvasEdges(state)).toBe(state);
  });
});

describe('resolveCanvasActionAvailability', () => {
  it('enables image-generate when a prompt is selected (member)', () => {
    const state = stateWith([promptNode('p')]);
    const res = resolveCanvasActionAvailability(state, ['p'], MEMBER);
    const gen = res.find((r) => r.actionType === 'image-generate');
    expect(gen?.available).toBe(true);
  });

  it('disables image-generate with needs_prompt when no prompt selected', () => {
    const state = stateWith([imageNode('a')]);
    const res = resolveCanvasActionAvailability(state, ['a'], MEMBER);
    const gen = res.find((r) => r.actionType === 'image-generate');
    expect(gen?.available).toBe(false);
    expect(gen?.reason).toBe('needs_prompt');
  });

  it('gates billable actions behind membership even when requirements are met', () => {
    const state = stateWith([promptNode('p')]);
    const res = resolveCanvasActionAvailability(state, ['p'], CANVAS_FREE_TIER_ENTITLEMENT);
    const gen = res.find((r) => r.actionType === 'image-generate');
    expect(gen?.available).toBe(false);
    expect(gen?.reason).toBe('membership_required');
  });

  it('requires two images for a storyboard', () => {
    const state = stateWith([imageNode('a'), imageNode('b')]);
    const res = resolveCanvasActionAvailability(state, ['a', 'b'], MEMBER);
    const sb = res.find((r) => r.actionType === 'storyboard-from-selection');
    expect(sb?.available).toBe(true);
  });
});

describe('createGeneratedImageNodes', () => {
  it('builds image nodes and generatedFrom edges to each source', () => {
    const { nodes, edges } = createGeneratedImageNodes({
      results: [{ url: 'https://x/a.png', generationId: 'g1', index: 0 }],
      placements: [{ x: 200, y: 0 }],
      sourceNodeIds: ['src1', 'src2'],
      createdAt: 't',
      makeNodeId: (i) => `node-${i}`,
      makeEdgeId: (i) => `edge-${i}`,
    });
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: 'node-0', kind: 'image', x: 200, resolvedUrl: 'https://x/a.png' });
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.kind === 'generatedFrom' && e.toNodeId === 'node-0')).toBe(true);
  });
});

describe('buildCanvasSelectionContext', () => {
  it('partitions a mixed selection by kind', () => {
    const state = stateWith([promptNode('p'), imageNode('i'), imageNode('unselected')]);
    const ctx = buildCanvasSelectionContext(state, ['p', 'i']);
    expect(ctx.prompts.map((x) => x.id)).toEqual(['p']);
    expect(ctx.images.map((x) => x.id)).toEqual(['i']);
  });
});

describe('mergeGeneratedResult', () => {
  it('replaces the placeholder matched by clientPlaceholderId and bumps revision', () => {
    const placeholder: GenerationTaskCanvasNode = {
      id: 'ph-node',
      kind: 'generationTask',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      createdAt: 't',
      updatedAt: 't',
      clientPlaceholderId: 'cpid-1',
      taskStatus: 'running',
    };
    const state = stateWith([placeholder]);
    const { nodes } = createGeneratedImageNodes({
      results: [{ url: 'u', generationId: 'g1' }],
      placements: [{ x: 0, y: 0 }],
      sourceNodeIds: [],
      createdAt: 't',
      makeNodeId: () => 'result-1',
      makeEdgeId: () => 'e',
    });
    const merged = mergeGeneratedResult(state, { nodes, edges: [], clientPlaceholderId: 'cpid-1', boardRevision: 9 });
    expect(merged.state.boardRevision).toBe(9);
    expect(merged.state.nodes.find((n) => n.id === 'ph-node')).toBeUndefined();
    expect(merged.state.nodes.find((n) => n.id === 'result-1')).toBeDefined();
    expect(merged.mapping).toMatchObject({ clientPlaceholderId: 'cpid-1', replaceNodeId: 'ph-node', resultNodeId: 'result-1' });
  });
});

describe('measureCanvasState', () => {
  it('flags a state exceeding the node limit', () => {
    const many = Array.from({ length: CANVAS_LIMITS.maxNodes + 1 }, (_, i) => imageNode(`n${i}`));
    const res = measureCanvasState(stateWith(many));
    expect(res.overLimit).toBe(true);
    expect(res.nodes).toBe(CANVAS_LIMITS.maxNodes + 1);
  });

  it('reports an empty board as well within limits', () => {
    const res = measureCanvasState(createEmptyCanvasBoardState());
    expect(res.overLimit).toBe(false);
    expect(res.nearLimit).toBe(false);
  });
});
