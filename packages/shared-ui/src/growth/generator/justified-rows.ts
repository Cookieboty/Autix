import { useCallback, useRef, useState } from 'react';

/** 行内相邻两格的间距（px）。图片与视频历史共用，改这里两边一起变。 */
export const JUSTIFIED_GAP = 3;

/**
 * justified 行打包：按目标行高贪心分行；每满一行再按容器宽度反算实际行高，
 * 使整行正好铺满宽度 —— 每格始终按真实比例展示（不裁切），窗口缩小时整体等比缩小。
 *
 * 图片历史与视频历史用的是同一套版式，所以放在这里共用：两边各留一份的话，
 * 「末行不拉伸」「gap 参与宽度反算」这类容易写错的细节早晚会漂成两个样子。
 */
export function buildJustifiedRows<T extends { ratio: number }>(
  cells: T[],
  containerWidth: number,
  targetHeight: number,
): Array<{ cells: T[]; height: number }> {
  if (containerWidth <= 0 || cells.length === 0) return [];
  const rows: Array<{ cells: T[]; height: number }> = [];
  let row: T[] = [];
  let ratioSum = 0;
  for (const cell of cells) {
    row.push(cell);
    ratioSum += cell.ratio;
    const naturalWidth = ratioSum * targetHeight + (row.length - 1) * JUSTIFIED_GAP;
    if (naturalWidth >= containerWidth) {
      const available = containerWidth - (row.length - 1) * JUSTIFIED_GAP;
      rows.push({ cells: row, height: available / ratioSum });
      row = [];
      ratioSum = 0;
    }
  }
  // 末行不拉伸，保持目标行高（左对齐、右侧留白）
  if (row.length) rows.push({ cells: row, height: targetHeight });
  return rows;
}

/** 订阅元素宽度（ResizeObserver，callback ref 以适配元素延迟挂载），用于 justified 行高计算 */
export function useElementWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    observerRef.current = observer;
  }, []);
  return { ref, width };
}
