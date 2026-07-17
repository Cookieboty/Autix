'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

/** /asset 默认进「全部素材」。与 /membership 的默认子路由同一写法（客户端 replace，保 locale 前缀）。 */
export default function AssetIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/asset/all');
  }, [router]);

  return null;
}
