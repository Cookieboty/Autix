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

  // phase-3 review Finding 1: the debounced quoter below is created once via useRef so the
  // pending-call timer survives re-renders (recreating it on every render would drop pending
  // calls / reset the debounce window). But that means its closure would otherwise only ever see
  // the FIRST render's `taskType`/`modelConfigId`/`usage`/`onQuote` — e.g. after a model switch it
  // would keep quoting the stale `modelConfigId` (permanently `undefined` if the model list hadn't
  // resolved yet at mount). Mirror them into a ref on every render instead, and have the debounced
  // body read `latestRef.current` when it actually fires, so it always sees the current values
  // while keeping ONE stable timer.
  const latestRef = useRef({ taskType, modelConfigId, usage, onQuote });
  latestRef.current = { taskType, modelConfigId, usage, onQuote };

  const debouncedRef = useRef(
    debounce(async (nextParams: Record<string, unknown>) => {
      const { taskType: currentTaskType, modelConfigId: currentModelConfigId, usage: currentUsage, onQuote: currentOnQuote } =
        latestRef.current;
      try {
        const result = await pricingActions.quoteTask(currentTaskType, {
          modelConfigId: currentModelConfigId,
          params: nextParams,
          usage: currentUsage,
        });
        setTotal(result.total);
        setStale(false);
        setFailed(false);
        currentOnQuote?.(result);
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
