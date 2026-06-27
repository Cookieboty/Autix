'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// 中继页:不在此完成登录,只把结果回传给打开它的主页面(见 spec §3/§4.1)。
export default function OAuthPopupCallbackPage() {
  const params = useSearchParams();

  useEffect(() => {
    const channel = params.get('channel') ?? undefined;
    const code = params.get('code') ?? undefined;
    const linked = params.get('linked') ?? undefined;
    const error = params.get('error') ?? undefined;

    const opener = window.opener as Window | null;
    if (opener && opener !== window) {
      opener.postMessage(
        { source: 'autix-oauth', channel, code, linked, error },
        window.location.origin,
      );
      window.close();
      return;
    }

    // 无 opener 兜底(中继页被直接打开):退化为现有 /oauth/callback 完成逻辑
    window.location.replace(`/oauth/callback${window.location.search}`);
  }, [params]);

  return null;
}
