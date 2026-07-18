'use client';

import { useEffect, useRef } from 'react';
import { reportResourceView } from '@autix/shared-store';

/**
 * 列表曝光哨兵：铺满卡片（absolute inset-0），首次进入视口（≥50%）上报一次 scope='list'
 * （喂 pvCount），随后停止观察。放进 `relative` 卡片内即可，不占位、不挡点击。
 *
 * 只报「真正被看到」的卡片，避免把加载了但在下方从没露出的条目也计入 PV。
 * 后端还按分钟去重，短时反复进出视口不会重复计数。
 */
export function ImpressionSentinel({
  resourceType,
  resourceId,
}: {
  resourceType: string;
  resourceId: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (done) return;
        if (entries.some((e) => e.isIntersecting)) {
          done = true;
          reportResourceView({ resourceType, resourceId, scope: 'list' });
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [resourceType, resourceId]);

  return <span ref={ref} aria-hidden className="pointer-events-none absolute inset-0" />;
}
