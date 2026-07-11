'use client';

import { useEffect, useRef, useState } from 'react';
import { pricingActions, type QuoteTaskResult } from '@autix/shared-store';
import { cn } from '../ui/utils';
import { debounce } from './debounce';

export interface TotalPriceBarProps {
  taskType: string;
  modelConfigId: string | undefined;
  params: Record<string, unknown>;
  usage?: Record<string, unknown>;
  /** quote 拿到的规范化 snapshot 会通过这个回调交给调用方（用于随生成请求一起提交）。 */
  onQuote?: (result: QuoteTaskResult) => void;
  translateTotal: (total: number | null) => string;
}

export function TotalPriceBar({ taskType, modelConfigId, params, usage, onQuote, translateTotal }: TotalPriceBarProps) {
  const [total, setTotal] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);
  const debouncedRef = useRef(
    debounce(async (nextParams: Record<string, unknown>) => {
      try {
        const result = await pricingActions.quoteTask(taskType, { modelConfigId, params: nextParams, usage });
        setTotal(result.total);
        setStale(false);
        setFailed(false);
        onQuote?.(result);
      } catch {
        // spec §6.8: quote 失败不阻塞生成，总价显示 — ，之前的值不保留
        // （保留旧值会让用户以为那是当前参数的价格，比显示 — 更误导）。
        setFailed(true);
        setStale(false);
      }
    }, 300),
  );

  useEffect(() => {
    setStale(total !== null);
    debouncedRef.current(params);
    return () => debouncedRef.current.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskType, modelConfigId, JSON.stringify(params), JSON.stringify(usage)]);

  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-lg font-semibold tabular-nums', stale && 'text-muted-foreground/60')}>
        {failed ? '—' : translateTotal(total)}
      </span>
    </div>
  );
}
