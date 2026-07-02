// Pure mapping between the Excalidraw scene and our server-persisted
// CanvasBoardState. Design:
//  - The full Excalidraw element list (geometry, arrows, freedraw, text) is
//    stored under state.metadata.excalidraw so nothing is lost on round-trip.
//  - Image elements additionally mirror into state.nodes as image nodes so the
//    backend can index asset refs and reverse-look-up dependencies.
//  - Binary files are NEVER persisted (would bloat JSON / embed data URLs);
//    each image element carries its stable asset URL in customData.assetUrl and
//    the file map is rebuilt from that on load.

import {
  type CanvasBoardState,
  type CanvasNode,
  createEmptyCanvasBoardState,
} from '@autix/domain';

export const DRAW_SCENE_METADATA_KEY = 'excalidraw';

/** Structural subset of an Excalidraw element we read/write. */
export interface DrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fileId?: string | null;
  customData?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface DrawBinaryFile {
  id: string;
  dataURL: string;
  mimeType: string;
  created: number;
}

function assetUrlOf(element: DrawElement): string | null {
  const url = element.customData?.assetUrl;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

/** Map the live scene into a persistable board state. */
export function sceneToBoardState(
  elements: readonly DrawElement[],
  boardRevision: number,
  now: string,
): CanvasBoardState {
  const nodes: CanvasNode[] = [];
  for (const el of elements) {
    if (el.type !== 'image') continue;
    const url = assetUrlOf(el);
    nodes.push({
      id: el.id,
      kind: 'image',
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      createdAt: now,
      updatedAt: now,
      assetRef: { type: 'external', url: url ?? '', trustLevel: 'user_added' },
    });
  }

  return {
    ...createEmptyCanvasBoardState(boardRevision),
    nodes,
    metadata: { [DRAW_SCENE_METADATA_KEY]: { elements: elements as unknown[] } },
  };
}

/** Rebuild the Excalidraw scene (elements + file map) from a board state. */
export function boardStateToScene(state: CanvasBoardState): {
  elements: DrawElement[];
  files: Record<string, DrawBinaryFile>;
} {
  const meta = state.metadata?.[DRAW_SCENE_METADATA_KEY] as { elements?: DrawElement[] } | undefined;
  const elements = Array.isArray(meta?.elements) ? (meta?.elements as DrawElement[]) : [];

  const files: Record<string, DrawBinaryFile> = {};
  for (const el of elements) {
    if (el.type !== 'image' || !el.fileId) continue;
    const url = assetUrlOf(el);
    if (!url) continue;
    files[el.fileId] = { id: el.fileId, dataURL: url, mimeType: 'image/png', created: 0 };
  }
  return { elements, files };
}

/** True when two scenes differ enough to warrant a save (avoids churn). */
export function sceneSignature(elements: readonly DrawElement[]): string {
  return elements
    .map((el) => `${el.id}:${Math.round(el.x)}:${Math.round(el.y)}:${Math.round(el.width)}:${Math.round(el.height)}`)
    .join('|');
}
