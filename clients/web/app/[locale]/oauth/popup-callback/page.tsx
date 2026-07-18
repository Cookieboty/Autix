'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

// 中继页:不在此完成登录,只把结果回传给打开它的主页面(见 spec §3/§4.1)。
// 主信道用 BroadcastChannel(同源、不依赖 window.opener);三方授权页往返会切断
// opener,故 opener.postMessage 仅作兼容信道。
export default function OAuthPopupCallbackPage() {
  const params = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const channel = params.get('channel') ?? undefined;
    const code = params.get('code') ?? undefined;
    const linked = params.get('linked') ?? undefined;
    const error = params.get('error') ?? undefined;
    const proof = params.get('proof') ?? undefined;
    const purpose = params.get('purpose') ?? undefined;
    if (proof) window.history.replaceState(null, '', window.location.pathname);
    const payload = { source: 'autix-oauth', channel, code, linked, error, proof, purpose };

    let delivered = false;

    // 主信道:BroadcastChannel(同源,不依赖 opener)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('autix-oauth');
        bc.postMessage(payload);
        // 不立即 bc.close():留给 window.close() 回收,避免打断消息派发
        delivered = true;
      } catch {
        /* ignore */
      }
    }

    // 兼容信道:opener.postMessage(opener 未被切断时)
    const opener = window.opener as Window | null;
    if (opener && opener !== window) {
      try {
        opener.postMessage(payload, window.location.origin);
        delivered = true;
      } catch {
        /* ignore */
      }
    }

    if (delivered) {
      // 留一个事件循环 tick 给消息派发,再自我关闭
      window.setTimeout(() => window.close(), 60);
      return;
    }

    // 兜底(无 BroadcastChannel 且无 opener,极旧环境):本窗退化为现有 /oauth/callback。
    // 刻意保持裸路径:/oauth/* 是 locale 中立端点(见 lib/proxy-handler.ts 的
    // LOCALE_NEUTRAL_PREFIXES),回调页必须在默认 locale 下渲染,其 intl router 才是
    // passthrough,带前缀的 returnTo 才不会被二次加前缀。加前缀会重新引入双前缀 404。
    window.location.replace(`/oauth/callback${window.location.search}`);
  }, [params]);

  return null;
}
