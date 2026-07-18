import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

type LookupRecord = { address: string; family: number };
type LookupFn = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<LookupRecord[]>;

// 默认使用真实 DNS；测试可通过 setSafeFetchResolver 注入 stub，避免对保留域名做真实解析。
let resolveHostname: LookupFn = lookup as unknown as LookupFn;

/** 仅供测试：覆盖/还原 SSRF 校验使用的 DNS 解析器（传 null 还原为真实 lookup）。 */
export function setSafeFetchResolver(fn: LookupFn | null): void {
  resolveHostname = fn ?? (lookup as unknown as LookupFn);
}

/**
 * SSRF 防护：判断一个 IP 字面量是否指向私有 / 回环 / 链路本地 / 保留网段。
 * 覆盖 IPv4 常见内网段与云元数据地址（169.254.169.254），以及 IPv6 回环 / ULA / 链路本地。
 */
// 从 IPv4-mapped IPv6（::ffff:0:0/96）中提取内嵌的 IPv4，兼容点分与十六进制两种写法。
// WHATWG URL 会把 [::ffff:127.0.0.1] 归一化为 ::ffff:7f00:1（十六进制），故必须同时处理。
// 仅认严格的映射前缀，避免误伤高位非零的公网 IPv6（如 2001:db8::ffff:7f00:1）。
function extractMappedIpv4(addr: string): string | null {
  const m = addr.match(/^(?:::ffff:|(?:0:){5}ffff:)(.+)$/);
  if (!m) return null;
  const tail = m[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(tail)) return tail;
  const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

export function isPrivateIpAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 6) {
    const normalized = address.toLowerCase();
    // 先解出 IPv4-mapped 内嵌地址（含十六进制形式），按 IPv4 规则判定
    const mappedIpv4 = extractMappedIpv4(normalized);
    if (mappedIpv4) return isPrivateIpAddress(mappedIpv4);
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80')
    );
  }
  if (kind !== 4) {
    // 非 IP 字面量（主机名）在这里保守视为需进一步 DNS 解析，不直接判私有。
    return false;
  }
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
    (a === 169 && b === 254) || // 链路本地 / 云元数据
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // 组播 / 保留
  );
}

/**
 * 校验待抓取 URL 是否安全：仅允许 http(s)，拒绝 localhost/.local，
 * 并对主机名做 DNS 解析、拒绝任何解析到私有网段的地址（防 DNS rebinding / 内网穿透）。
 * 抓取前必须调用；对每一跳重定向都需重新调用。
 */
export async function assertSafeFetchUrl(value: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Unsafe fetch URL (invalid): ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsafe fetch URL (scheme not allowed): ${url.protocol}`);
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('Unsafe fetch URL (loopback host not allowed)');
  }
  if (isIP(hostname)) {
    if (isPrivateIpAddress(hostname)) {
      throw new Error('Unsafe fetch URL (private address not allowed)');
    }
    return;
  }
  const records = await resolveHostname(hostname, { all: true, verbatim: true }).catch(() => {
    throw new Error(`Unsafe fetch URL (DNS resolution failed): ${hostname}`);
  });
  if (records.length === 0 || records.some((record) => isPrivateIpAddress(record.address))) {
    throw new Error('Unsafe fetch URL (resolves to private address)');
  }
}

const MAX_SAFE_FETCH_REDIRECTS = 3;
const SAFE_FETCH_TIMEOUT_MS = 30_000;

/**
 * fetch 的 SSRF 安全封装：抓取前与每一跳重定向都重新做 {@link assertSafeFetchUrl} 校验，
 * 使用 `redirect: 'manual'` 手动跟随，避免底层 fetch 自动跳转绕过校验。
 *
 * 超时权威归调用方：`opts.timeoutMs` 未给时才用默认 30s。调用方自带的 `init.signal`
 * 与超时 signal **组合**（AbortSignal.any），不再被覆盖 —— 否则上层的取消/更长超时
 * 会被本函数静默吞掉（视频任务的上游调用需要长于 30s 的窗口）。
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
  opts?: { timeoutMs?: number },
): Promise<Response> {
  // data: URL 内联字节、不发起网络请求，无 SSRF 风险，直接交给 fetch（保持原有单参调用签名）。
  if (/^data:/i.test(url)) {
    return init ? fetch(url, init) : fetch(url);
  }
  let currentUrl = url;
  for (let redirects = 0; redirects <= MAX_SAFE_FETCH_REDIRECTS; redirects += 1) {
    await assertSafeFetchUrl(currentUrl);
    // 超时用手动 controller + `finally { clearTimeout }`，**不能**换成 AbortSignal.timeout：
    // 那个 finally 不是单纯的清理 —— 它在本函数 return Response 的瞬间**解除**超时，使超时
    // 只约束「拿到响应头」，而不约束调用方随后在函数外读 body（`res.arrayBuffer()` 等）。
    // AbortSignal.timeout 无法解除，会一路延续到 body 流：一个 30s 才下完的大视频/大图会
    // 被判超时，即便上游早已成功出片（generation 被误标 failed 且已扣费）。
    // 调用方 signal 用 AbortSignal.any 组合进来，不覆盖 —— 上层的取消/更长窗口必须生效。
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts?.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS,
    );
    const signal = init?.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;
    try {
      const res = await fetch(currentUrl, {
        ...init,
        redirect: 'manual',
        signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location || redirects === MAX_SAFE_FETCH_REDIRECTS) {
          throw new Error('Unsafe fetch URL (too many or invalid redirects)');
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Unsafe fetch URL (too many redirects)');
}
