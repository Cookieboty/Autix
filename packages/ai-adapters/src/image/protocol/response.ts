import type { ImageArtifact, ResponseSpec } from './types';

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cursor, key) => {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    return (cursor as Record<string, unknown>)[key];
  }, source);
}

/** 展开 `a[*].b[*]` 形式的通配路径，返回叶子节点数组。畸形输入 → 空数组，绝不抛。 */
function collectItems(source: unknown, itemsPath: string): unknown[] {
  let cursors: unknown[] = [source];
  for (const segment of itemsPath.split('.')) {
    const wildcard = segment.endsWith('[*]');
    const key = wildcard ? segment.slice(0, -3) : segment;
    const next: unknown[] = [];
    for (const cursor of cursors) {
      if (cursor === null || typeof cursor !== 'object') continue;
      const value = (cursor as Record<string, unknown>)[key];
      if (wildcard) {
        if (Array.isArray(value)) next.push(...value);
      } else if (value !== undefined) {
        next.push(value);
      }
    }
    cursors = next;
  }
  return cursors;
}

export function extractArtifacts(spec: ResponseSpec, json: unknown): ImageArtifact[] {
  const artifacts: ImageArtifact[] = [];
  for (const item of collectItems(json, spec.itemsPath)) {
    if (item === null || typeof item !== 'object') continue;

    const b64 = spec.b64Field ? readPath(item, spec.b64Field) : undefined;
    const url = spec.urlField ? readPath(item, spec.urlField) : undefined;
    const mime = spec.mimeField ? readPath(item, spec.mimeField) : undefined;
    const mimeType = typeof mime === 'string' ? mime : undefined;

    let source: ImageArtifact['source'] | undefined;
    if (typeof b64 === 'string' && b64.length > 0) {
      source = { type: 'base64', data: b64, mimeType: mimeType ?? spec.defaultMime };
    } else if (typeof url === 'string' && url.length > 0) {
      source = { type: 'url', url, mimeType };
    }
    if (!source) continue;

    const seed = spec.seedField ? readPath(item, spec.seedField) : undefined;
    const revised = spec.revisedPromptField ? readPath(item, spec.revisedPromptField) : undefined;

    artifacts.push({
      source,
      index: artifacts.length,
      ...(typeof seed === 'string' ? { seed } : {}),
      ...(typeof revised === 'string' ? { revisedPrompt: revised } : {}),
    });
  }
  return artifacts;
}
