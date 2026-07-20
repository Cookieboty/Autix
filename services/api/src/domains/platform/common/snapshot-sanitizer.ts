import { createHash } from 'node:crypto';

export const SNAPSHOT_BYTE_LIMIT = 16 * 1024;
export const UPSTREAM_BODY_BYTE_LIMIT = 4 * 1024;

/** 凭据字段：按名字匹配（大小写不敏感），新增 provider 时默认被覆盖而非默认泄露。 */
const CREDENTIAL_KEYS = new Set([
  'callback_url',
  'apikey',
  'api_key',
  'authorization',
  'token',
  'secret',
  'password',
]);

/** 签名/时效参数：出现即说明该 URL 是带凭据的，整段查询串都丢掉。 */
const SIGNED_URL_PARAMS = ['x-amz-signature', 'signature', 'sig', 'expires', 'token'];

const DATA_URL_RE = /^data:([^;,]+)?(;base64)?,(.*)$/s;

export function truncateToBytes(text: string, limitBytes: number): string {
  const buf = Buffer.from(text, 'utf8');
  if (buf.byteLength <= limitBytes) return text;
  // 按字节切会切碎多字节字符，用 toString 的替换字符边界回退一位直到合法。
  let end = limitBytes;
  let sliced = buf.subarray(0, end).toString('utf8');
  while (end > 0 && sliced.endsWith('�')) {
    end -= 1;
    sliced = buf.subarray(0, end).toString('utf8');
  }
  return `${sliced}…[truncated, totalBytes=${buf.byteLength}]`;
}

function summarizeDataUrl(value: string): Record<string, unknown> | null {
  const m = DATA_URL_RE.exec(value);
  if (!m) return null;
  const payload = m[3] ?? '';
  return {
    type: m[1] ?? 'application/octet-stream',
    bytes: payload.length,
    sha256: createHash('sha256').update(payload).digest('hex').slice(0, 16),
  };
}

function stripSignedUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    const hasSignature = [...url.searchParams.keys()].some((k) =>
      SIGNED_URL_PARAMS.includes(k.toLowerCase()),
    );
    if (!hasSignature) return value;
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function walk(value: unknown): unknown {
  if (typeof value === 'string') {
    const dataUrl = summarizeDataUrl(value);
    if (dataUrl) return dataUrl;
    return stripSignedUrl(value);
  }
  if (Array.isArray(value)) return value.map(walk);
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (CREDENTIAL_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = walk(val);
    }
  }
  return out;
}

/**
 * 领域无关的快照净化器：落库/落日志前统一处理。
 * 与图片/视频领域解耦，故不复用视频域的 redactProviderRequest（那个只遮盖顶层 callback_url）。
 */
export function sanitizeSnapshot(
  value: unknown,
  limitBytes: number = SNAPSHOT_BYTE_LIMIT,
): unknown {
  const cleaned = walk(value);
  const serialized = JSON.stringify(cleaned);
  if (serialized !== undefined && Buffer.byteLength(serialized, 'utf8') > limitBytes) {
    return { truncated: true, preview: truncateToBytes(serialized, limitBytes - 100) };
  }
  return cleaned;
}
