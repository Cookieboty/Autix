export type OAuthPopupResult = {
  code?: string;
  linked?: string;
  error?: string;
  cancelled?: boolean;
};

const POPUP_NAME = 'autix-oauth';
// 不含 noopener/noreferrer:本流程依赖 window.opener.postMessage(见 spec §5)
const POPUP_FEATURES = 'popup=yes,width=520,height=640';
const FLOW_TIMEOUT_MS = 10 * 60 * 1000; // 与后端 state TTL 对齐
const CLOSE_POLL_MS = 400;

export function newChannel(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 必须在用户手势(click)中同步调用,以规避弹窗拦截器;返回 null 表示被拦截。
export function openBlankPopup(): Window | null {
  return window.open('', POPUP_NAME, POPUP_FEATURES);
}

export function driveOAuthPopup(
  popup: Window,
  authorizeUrl: string,
  channel: string,
): Promise<OAuthPopupResult> {
  return new Promise<OAuthPopupResult>((resolve) => {
    let settled = false;
    let pollId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (pollId) clearInterval(pollId);
      if (timeoutId) clearTimeout(timeoutId);
    };
    const finish = (result: OAuthPopupResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== popup) return;
      const data = event.data as
        | { source?: string; channel?: string; code?: string; linked?: string; error?: string }
        | null;
      if (!data || data.source !== 'autix-oauth') return;
      if (data.channel !== channel) return; // per-attempt 校验:丢弃同名 popup 复用时旧流程晚到消息
      finish({ code: data.code, linked: data.linked, error: data.error });
    };

    window.addEventListener('message', onMessage);
    pollId = setInterval(() => {
      if (popup.closed) finish({ cancelled: true });
    }, CLOSE_POLL_MS);
    timeoutId = setTimeout(() => finish({ cancelled: true }), FLOW_TIMEOUT_MS);

    try {
      popup.location.href = authorizeUrl;
    } catch {
      finish({ error: 'OAUTH_POPUP_NAVIGATION_FAILED' });
    }
  });
}
