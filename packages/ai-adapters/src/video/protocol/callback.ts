import { createHash, timingSafeEqual } from 'node:crypto';
import { normalizeVideoOutcome, readPath } from './result';
import type { VideoProtocolPreset, VideoTaskOutcome } from './types';

/**
 * 常量时间比较（先 sha256 等长化，避免长度侧信道），任一为空即失败。
 * 原样继承自 services/api/.../video-callback.handler.ts:5-10。
 */
function secretsMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * 校验回调请求。不通过即抛 —— 调用方应把它映射成 401。
 *
 * **fail-closed 是不可协商的契约**（继承自 handler.ts:35-38）：`secretRef` 指向的
 * 环境变量未配置时**拒绝**回调，而不是放行。否则任何人都能伪造回调驱动状态机与计费。
 */
export function verifyVideoCallback(args: {
  preset: VideoProtocolPreset;
  token?: string;
  /** 由调用方从 `preset.webhook.verification.secretRef` 指向的环境变量读出后传入。 */
  secret?: string;
}): void {
  const webhook = args.preset.webhook;
  if (!webhook) {
    throw new Error(`preset "${args.preset.key}" does not support callbacks`);
  }
  if (!args.secret) {
    throw new Error(
      `video callback secret (${webhook.verification.secretRef}) is not configured — rejecting`,
    );
  }
  if (!secretsMatch(args.token, args.secret)) {
    throw new Error('invalid or missing token');
  }
}

/** 解析回调体：取任务 id + 归一化终态。调用方必须先过 verifyVideoCallback。 */
export function parseVideoCallback(args: {
  preset: VideoProtocolPreset;
  body: unknown;
  onWarn?: (message: string) => void;
}): { providerTaskId?: string; outcome: VideoTaskOutcome } {
  const webhook = args.preset.webhook;
  if (!webhook) {
    throw new Error(`preset "${args.preset.key}" does not support callbacks`);
  }
  const taskId = readPath(args.body, webhook.taskIdPath);
  // 回调体与 query 响应不同构时才声明 webhook.result；Ark 二者同构，故回退到 preset.result。
  const spec = webhook.result ?? args.preset.result;
  return {
    providerTaskId: typeof taskId === 'string' && taskId ? taskId : undefined,
    outcome: normalizeVideoOutcome(spec, args.body, args.onWarn),
  };
}
