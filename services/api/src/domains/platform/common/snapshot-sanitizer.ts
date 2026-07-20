import { createHash } from 'node:crypto';

export const SNAPSHOT_BYTE_LIMIT = 16 * 1024;
export const UPSTREAM_BODY_BYTE_LIMIT = 4 * 1024;

/**
 * 凭据字段：**精确**匹配字段名（仅大小写不敏感），不是子串匹配也不是前缀匹配。
 *
 * 即：只有名字与下列条目完全相等的键会被遮盖。`access_token`、`x-api-key`、
 * `apiSecret`、`callbackUrl` 这类变体**会原样透传**——新增 provider 时默认是
 * 泄露而非默认被覆盖，加新 provider 必须回来手工补齐它用的字段名。
 *
 * 目前可接受：本净化器的输入是 paramsSnapshot（用户请求参数），不是 provider
 * 凭据，所以实际暴露面很小。改成子串匹配是后续动作，不在本次改动范围内。
 */
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

function walk(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') {
    const dataUrl = summarizeDataUrl(value);
    if (dataUrl) return dataUrl;
    return stripSignedUrl(value);
  }

  // 函数/Symbol/BigInt 不满足 Prisma.InputJsonValue：函数和 Symbol 会被 JSON.stringify
  // 静默丢弃（不报错但字段消失），BigInt 会直接让 JSON.stringify 抛 TypeError。三者
  // 必须在通用 object 分支之前降级成字符串，否则调用方裸 `as Prisma.InputJsonValue`
  // 断言在编译期放行、运行时才炸。
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return String(value);
  if (typeof value === 'bigint') return value.toString();

  // Date/Map/Set 的 typeof 是 object 但没有可枚举自有属性，走通用分支会被
  // Object.entries 判成空对象、静默清空，必须在通用分支之前特判。
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? '[Invalid Date]' : value.toISOString();
  }

  if (value instanceof Map) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const entries = [...value.entries()].map(([k, v]) => [walk(k, seen), walk(v, seen)]);
    seen.delete(value);
    return entries;
  }

  if (value instanceof Set) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const items = [...value.values()].map((v) => walk(v, seen));
    seen.delete(value);
    return items;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const result = value.map((v) => walk(v, seen));
    seen.delete(value);
    return result;
  }
  if (!value || typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  // 用 Object.create(null) 而非 {}：`{}` 的原型链上挂着 Object.prototype 的
  // __proto__ 存取器，裸赋值 out['__proto__'] = x 在自有属性不存在时会走那个
  // setter（篡改原型、数据静默丢失），而不是新增自有属性。无原型对象没有这个
  // 存取器，[[Set]] 找不到任何同名属性/访问器时会直接落成普通自有数据属性。
  const out: Record<string, unknown> = Object.create(null);
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (CREDENTIAL_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = walk(val, seen);
    }
  }
  seen.delete(value);
  return out;
}

/** 单个字符经 JSON.stringify 转义后占用的 UTF-8 字节数（含转义符本身）。 */
function escapedCharByteLength(ch: string): number {
  if (ch === '"' || ch === '\\') return 2;
  const code = ch.codePointAt(0)!;
  switch (code) {
    case 0x08: // \b
    case 0x09: // \t
    case 0x0a: // \n
    case 0x0c: // \f
    case 0x0d: // \r
      return 2;
    default:
      if (code < 0x20) return 6; // \u00XX
      return Buffer.byteLength(ch, 'utf8');
  }
}

/**
 * 截取 text 的前缀，使其被 JSON.stringify 成字符串字面量后（含首尾引号与内部转义）
 * 不超过 budgetBytes 字节。
 *
 * 与 truncateToBytes 不同：那个按“原始字节数”截断，这里模拟的是“这段文本作为
 * 字符串值被再次序列化后”会膨胀到多少字节——用于降级路径里 preview 字段本身就是
 * 一段已经是 JSON 文本（天然充满 "/\）的场景，防止调用方二次 JSON.stringify 时
 * 体积反弹击穿上限。
 */
function truncateForJsonEmbedding(text: string, budgetBytes: number): string {
  if (budgetBytes < 2) return '';
  let used = 2; // 首尾引号
  let result = '';
  for (const ch of text) {
    const bytes = escapedCharByteLength(ch);
    if (used + bytes > budgetBytes) break;
    used += bytes;
    result += ch;
  }
  return result;
}

/**
 * 领域无关的快照净化器：落库/落日志前统一处理。
 * 与图片/视频领域解耦，故不复用视频域的 redactProviderRequest（那个只遮盖顶层 callback_url）。
 *
 * 返回契约：正常情况下返回净化后的值本身；超过 limitBytes 时返回
 * `{ __snapshotTruncated: true, totalBytes: number, preview: string }`——截断标记用
 * `__snapshotTruncated` 而非裸 `truncated`，避免与真实快照里恰好同名的业务字段
 * （`truncated`/`totalBytes`/`preview` 三个都可能是合法业务键）产生双形态歧义，
 * 让下游误把截断信封当成原始数据解析。其中 preview 是
 * `JSON.stringify(cleaned)` 的原始前缀（未经二次转义）。
 *
 * 调用方需要再对返回值 `JSON.stringify` 一次落库——这里保证的是「调用方那次
 * JSON.stringify 之后」的字节数一定 <= limitBytes，而不仅仅是 preview 自身的
 * 原始字节数 <= limitBytes（这正是本函数要修的旧 bug：preview 里全是 "/\ 时，
 * 调用方二次序列化会把体积再翻一倍，击穿上限）。
 */
export function sanitizeSnapshot(
  value: unknown,
  limitBytes: number = SNAPSHOT_BYTE_LIMIT,
): unknown {
  const cleaned = walk(value);
  const serialized = JSON.stringify(cleaned);
  const totalBytes = serialized === undefined ? 0 : Buffer.byteLength(serialized, 'utf8');
  if (serialized === undefined || totalBytes <= limitBytes) {
    return cleaned;
  }

  const shapeWithEmptyPreview = { __snapshotTruncated: true, totalBytes, preview: '' };
  const fixedBytes = Buffer.byteLength(JSON.stringify(shapeWithEmptyPreview), 'utf8');
  const previewBudget = Math.max(0, limitBytes - fixedBytes);
  const preview = truncateForJsonEmbedding(serialized, previewBudget);
  return { __snapshotTruncated: true, totalBytes, preview };
}
