'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 框选：在内容区按下并拖动，划过的素材即被选中。
 *
 * 几个必须处理的坑：
 * - **不能一按下就进入框选**：那样普通的「点一下打开详情」会被吃掉。这里等移动超过
 *   DRAG_THRESHOLD 才算框选开始，之前一律当普通点击。
 * - 框选结束后要压掉紧随其后的 click：浏览器在 mouseup 后仍会派发 click，
 *   不拦的话松手瞬间会顺带打开详情弹窗。suppressClick 就是干这个的。
 * - 坐标一律用**视口坐标**（clientX/Y + getBoundingClientRect），不用 pageX/Y：
 *   内容卡自身是滚动容器，页面坐标与元素矩形不在同一参照系。
 * - 命中判定用矩形相交而非「包含」——划过一角就该选中，不必框住整张。
 */

const DRAG_THRESHOLD = 5;

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function intersects(a: DOMRect, b: MarqueeRect) {
  return !(
    a.right < b.left ||
    a.left > b.left + b.width ||
    a.bottom < b.top ||
    a.top > b.top + b.height
  );
}

export function useMarqueeSelection({
  selected,
  onSelectedChange,
}: {
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
}) {
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const baseSelectionRef = useRef<Set<string>>(new Set());
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [rect, setRect] = useState<MarqueeRect | null>(null);

  const registerCard = useCallback((id: string, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      // 只接左键；右键要留给上下文菜单。
      if (event.button !== 0) return;
      // 从卡片上的按钮（勾选框/更多）按下时不进入框选，交给按钮自己。
      if ((event.target as HTMLElement).closest('button')) return;
      originRef.current = { x: event.clientX, y: event.clientY };
      // 按住 shift/meta 时在原选择集上叠加，否则从空集开始。
      baseSelectionRef.current = event.shiftKey || event.metaKey ? new Set(selected) : new Set();
    },
    [selected],
  );

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const origin = originRef.current;
      if (!origin) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (!draggingRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      draggingRef.current = true;

      const next: MarqueeRect = {
        left: Math.min(origin.x, event.clientX),
        top: Math.min(origin.y, event.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      };
      setRect(next);

      const hit = new Set(baseSelectionRef.current);
      for (const [id, el] of cardRefs.current) {
        if (intersects(el.getBoundingClientRect(), next)) hit.add(id);
      }
      onSelectedChange(hit);
    };

    const handleUp = () => {
      if (draggingRef.current) {
        suppressClickRef.current = true;
        // 只压掉紧跟这次 mouseup 的那一个 click。
        //
        // 之前把清除放在卡片的 onClick 里：拖拽若结束在卡片**之外**（空白处松手是常事），
        // 根本没有卡片 click 来清它，标志就一直armed，把用户下一次真实的点击吞掉——
        // 表现为「框选一次之后，第一次点图片没反应」。
        // 浏览器在 mouseup 之后同步派发 click，故下一个宏任务里清除必定晚于那一个 click、
        // 又早于用户任何后续操作。
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      originRef.current = null;
      draggingRef.current = false;
      setRect(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [onSelectedChange]);

  /**
   * 卡片点击前调用：刚结束框选则吞掉这一次 click。
   * 不在这里清除标志——清除由 mouseup 的下一个宏任务负责，否则「拖拽结束在卡片外」
   * 这条路径永远等不到清除。
   */
  const shouldSuppressClick = useCallback(() => suppressClickRef.current, []);

  return { rect, registerCard, onMouseDown, shouldSuppressClick };
}
