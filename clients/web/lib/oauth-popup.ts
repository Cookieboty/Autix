export type OAuthPopupResult = {
  code?: string;
  linked?: string;
  error?: string;
  cancelled?: boolean;
};

const POPUP_NAME = 'autix-oauth';
// 不含 noopener/noreferrer:postMessage 兼容信道需要 window.opener(见 spec §5)
const POPUP_FEATURES = 'popup=yes,width=520,height=640';
const BROADCAST_NAME = 'autix-oauth';
const FLOW_TIMEOUT_MS = 10 * 60 * 1000; // 与后端 state TTL 对齐(放弃流程的兜底)

export function newChannel(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 必须在用户手势(click)中同步调用,以规避弹窗拦截器;返回 null 表示被拦截。
export function openBlankPopup(): Window | null {
  return window.open('', POPUP_NAME, POPUP_FEATURES);
}

type RelayData = {
  source?: string;
  channel?: string;
  code?: string;
  linked?: string;
  error?: string;
} | null;

export function driveOAuthPopup(
  popup: Window,
  authorizeUrl: string,
  channel: string,
): Promise<OAuthPopupResult> {
  return new Promise<OAuthPopupResult>((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let bc: BroadcastChannel | undefined;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (bc) {
        try {
          bc.close();
        } catch {
          /* ignore */
        }
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
    const finish = (result: OAuthPopupResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    // per-attempt channel 校验:丢弃同名 popup 复用时旧流程晚到消息
    const accept = (data: RelayData) => {
      if (!data || data.source !== 'autix-oauth') return;
      if (data.channel !== channel) return;
      finish({ code: data.code, linked: data.linked, error: data.error });
    };

    // 兼容信道:opener.postMessage(opener 未被 COOP 切断时,如部分 provider)。
    // 额外校验 origin + source 句柄。
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== popup) return;
      accept(event.data as RelayData);
    };
    window.addEventListener('message', onMessage);

    // 主信道:BroadcastChannel(同源,不依赖 opener)。三方授权页(如 Google)往返
    // 会切断 window.opener,postMessage 可能收不到,故以 BroadcastChannel 为主。
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BROADCAST_NAME);
      bc.onmessage = (event: MessageEvent) => accept(event.data as RelayData);
    }

    // 放弃兜底:无任何结果时超时取消(COOP 下无法可靠探测用户手动关闭弹窗)
    timeoutId = setTimeout(() => finish({ cancelled: true }), FLOW_TIMEOUT_MS);

    try {
      popup.location.href = authorizeUrl;
    } catch {
      finish({ error: 'OAUTH_POPUP_NAVIGATION_FAILED' });
    }
  });
}
