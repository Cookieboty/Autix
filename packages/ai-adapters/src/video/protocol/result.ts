import type { PathCandidates, ResultSpec, VideoTaskOutcome } from './types';

function readOne(payload: unknown, path: string): unknown {
  let cursor: unknown = payload;
  for (const segment of path.split('.')) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/**
 * 按序取第一个命中的候选 path。
 *
 * 为什么需要候选链：既有 getStringField（seedance-task-payload.ts:9-19）读 video_url
 * 时是两级回退 —— 先顶层 `video_url`，未命中再 `content.video_url`。这是从现有实现
 * 翻译出的真实约束。
 */
export function readPath(payload: unknown, candidates: PathCandidates): unknown {
  const list = Array.isArray(candidates) ? candidates : [candidates];
  for (const path of list) {
    const value = readOne(payload, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function readString(payload: unknown, candidates: PathCandidates | undefined): string | undefined {
  if (!candidates) return undefined;
  const value = readPath(payload, candidates);
  return typeof value === 'string' ? value : undefined;
}

/**
 * 厂商响应 → 内部统一终态。query 响应与 callback 体共用。
 *
 * 行为与既有 normalizeSeedanceTaskOutcome（video-generation-flow.helpers.ts:613-643）
 * 等价 —— 收敛逻辑一份，各家的状态字典在 preset 的 statusMap 里声明。
 */
export function normalizeVideoOutcome(
  spec: ResultSpec,
  payload: unknown,
  onWarn?: (message: string) => void,
): VideoTaskOutcome {
  const status = readString(payload, spec.statusPath);
  if (!status) return { kind: 'missing_status' };

  const mapped = spec.statusMap[status];

  if (mapped === undefined) {
    // 未知状态**不**判失败：那会误退款一个可能正在成功的生成。判 active 最坏是多轮询
    // 几轮，而无限轮询已被 video-generation-terminal-convergence 的超时收敛兜住。
    onWarn?.(`unknown upstream video status "${status}" — treating as active`);
    return { kind: 'active', externalStatus: status };
  }

  if (mapped === 'succeeded') {
    const durationRaw = spec.durationPath ? readPath(payload, spec.durationPath) : undefined;
    return {
      kind: 'succeeded',
      externalStatus: status,
      sourceUrl: readString(payload, spec.videoUrlPath),
      lastFrameUrl: readString(payload, spec.lastFrameUrlPath) ?? null,
      durationSec: typeof durationRaw === 'number' ? durationRaw : null,
    };
  }

  if (mapped === 'failed' || mapped === 'expired') {
    return {
      kind: mapped,
      externalStatus: status,
      // 无上游错误消息时回退到状态文本，与既有 getSeedanceErrorMessage(payload, status) 一致。
      error: readString(payload, spec.errorMessagePath) ?? status,
    };
  }

  return { kind: 'active', externalStatus: status };
}
