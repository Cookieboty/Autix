export interface TokenUsageLike {
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
}

export function estimateTextTokens(text: string): number {
  const normalized = String(text ?? '').trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(Array.from(normalized).length / 4));
}

export function extractTokenUsage(value: unknown): TokenUsageLike {
  const raw =
    readPath(value, ['usage_metadata']) ??
    readPath(value, ['response_metadata', 'tokenUsage']) ??
    readPath(value, ['response_metadata', 'token_usage']) ??
    readPath(value, ['llmOutput', 'tokenUsage']) ??
    readPath(value, ['llmOutput', 'token_usage']);

  if (!raw || typeof raw !== 'object') return {};
  const usage = raw as Record<string, unknown>;
  return {
    inputTokens: numberOrUndefined(
      usage.input_tokens ?? usage.promptTokens ?? usage.prompt_tokens,
    ),
    outputTokens: numberOrUndefined(
      usage.output_tokens ?? usage.completionTokens ?? usage.completion_tokens,
    ),
    contextTokens: numberOrUndefined(
      usage.context_tokens ?? usage.total_tokens ?? usage.totalTokens,
    ),
  };
}

function readPath(value: unknown, path: string[]) {
  let current = value as Record<string, unknown> | undefined;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key] as Record<string, unknown> | undefined;
  }
  return current;
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
