import type { LogLevel } from '@nestjs/common';

// 生产默认屏蔽 debug/verbose：Nest 默认打开全部级别，会把 job start、逐任务 poll ok 等
// debug 日志写进 stdout，抵消 job-context / video-flow 的降噪努力（评审 P1）。
// 通过 LOG_LEVEL 环境变量显式覆盖，如 `LOG_LEVEL=log,warn,error,debug`，或 `all`；
// NODE_ENV != production 默认打开全部级别，便于本地/CI 排障。
export const DEFAULT_LOG_LEVELS: readonly LogLevel[] = [
  'log',
  'warn',
  'error',
  'fatal',
];

export const ALL_LOG_LEVELS: readonly LogLevel[] = [
  'log',
  'warn',
  'error',
  'fatal',
  'debug',
  'verbose',
];

const ALL_LOG_LEVEL_SET: ReadonlySet<string> = new Set(ALL_LOG_LEVELS);

export interface ResolveLogLevelsInput {
  /** 显式的 `LOG_LEVEL` 值。传空/undefined 表示未设置。 */
  logLevel?: string | null | undefined;
  /** 显式的 `NODE_ENV` 值。传空/undefined 视为非 production。 */
  nodeEnv?: string | null | undefined;
}

/**
 * 计算 Nest 应启用的日志级别。抽成纯函数便于单测（评审建议）：
 * - 未设置 LOG_LEVEL：production 走 DEFAULT_LOG_LEVELS，其它环境走 ALL_LOG_LEVELS。
 * - LOG_LEVEL=all（不区分大小写）：启用全部级别。
 * - LOG_LEVEL=逗号分隔：过滤出合法级别；若过滤后为空则退回默认策略（防止拼错静默）。
 */
export function resolveLogLevels(input: ResolveLogLevelsInput = {}): LogLevel[] {
  const raw = input.logLevel?.trim();
  if (raw) {
    if (raw.toLowerCase() === 'all') return [...ALL_LOG_LEVELS];
    const parsed = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is LogLevel => ALL_LOG_LEVEL_SET.has(s));
    if (parsed.length > 0) return parsed;
  }
  return input.nodeEnv === 'production'
    ? [...DEFAULT_LOG_LEVELS]
    : [...ALL_LOG_LEVELS];
}

/** 便捷入口：从 `process.env` 读取。运行时装配使用。 */
export function resolveLogLevelsFromEnv(env: NodeJS.ProcessEnv = process.env): LogLevel[] {
  return resolveLogLevels({ logLevel: env.LOG_LEVEL, nodeEnv: env.NODE_ENV });
}
