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
export const DRAW_CONVERSATION_METADATA_KEY = 'conversation';

/** A persisted chat turn — the conversation is the board's carrier. */
export interface PersistedMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
}

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
  conversation: PersistedMessage[] = [],
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
    metadata: {
      [DRAW_SCENE_METADATA_KEY]: { elements: elements as unknown[] },
      [DRAW_CONVERSATION_METADATA_KEY]: conversation,
    },
  };
}

/** Restore the persisted conversation (the board's carrier). */
export function readConversation(state: CanvasBoardState): PersistedMessage[] {
  const raw = state.metadata?.[DRAW_CONVERSATION_METADATA_KEY];
  return Array.isArray(raw) ? (raw as PersistedMessage[]) : [];
}

/** All image URLs referenced by the conversation history, in order. */
export function conversationImageUrls(messages: readonly PersistedMessage[]): string[] {
  const urls: string[] = [];
  for (const msg of messages) for (const url of msg.images ?? []) if (!urls.includes(url)) urls.push(url);
  return urls;
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
  return JSON.stringify(
    elements.map((el) => ({
      id: el.id,
      type: el.type,
      isDeleted: el.isDeleted,
      x: roundForSignature(el.x),
      y: roundForSignature(el.y),
      width: roundForSignature(el.width),
      height: roundForSignature(el.height),
      angle: roundForSignature(asNumber(el.angle)),
      fileId: el.fileId,
      text: typeof el.text === 'string' ? el.text : undefined,
      points: Array.isArray(el.points) ? el.points : undefined,
      startBinding: el.startBinding,
      endBinding: el.endBinding,
      boundElements: el.boundElements,
      customData: el.customData,
      version: el.version,
      versionNonce: el.versionNonce,
    })),
  );
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roundForSignature(value: unknown): number {
  return Math.round(asNumber(value) * 100) / 100;
}
