'use client';

import { useCallback, useState, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

/**
 * 跟随光标位置的右键菜单。
 *
 * 为什么不直接把目标行/卡片当 DropdownMenuTrigger：
 * 1. Radix 的 Trigger 在 **pointerdown（左键）** 就开菜单 —— 左键点文件夹会既导航又弹菜单，
 *    也就是「左键和右键一个作用」；
 * 2. 菜单会锚在触发元素上，于是永远吊在那一行下方、还被侧栏宽度框住，
 *    而右键菜单应该出现在鼠标点的地方。
 *
 * 所以这里用一个 0×0 的固定定位锚点：它跟着光标坐标走，左键永远碰不到它。
 * 贴边翻转/位移交给 Radix 的碰撞检测（右键点在屏幕底部时菜单会自动向上翻）。
 */

/**
 * 菜单面板外观：与 /ai/image 的 ImageActionMenu 对齐（玻璃底 + 白边 + 大圆角），
 * 让整个产品的下拉只有一种长相。那边是 Popover 实现、item 只有图标+文字，
 * 装不下这里的复选框行与内联输入框，故复用**样式**而非组件。
 */
export const ASSET_MENU_PANEL_CLASS =
  'z-[130] gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.86)] p-1.5 text-foreground backdrop-blur-[32px]';

export const ASSET_MENU_ITEM_CLASS =
  'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold transition focus:bg-white/[0.08] data-[highlighted]:bg-white/[0.08]';

export interface CursorMenuState {
  position: { x: number; y: number } | null;
  open: boolean;
  openAt: (event: { preventDefault: () => void; clientX: number; clientY: number }) => void;
  close: () => void;
}

export function useCursorMenu(): CursorMenuState {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const openAt = useCallback(
    (event: { preventDefault: () => void; clientX: number; clientY: number }) => {
      event.preventDefault();
      setPosition({ x: event.clientX, y: event.clientY });
    },
    [],
  );

  const close = useCallback(() => setPosition(null), []);

  return { position, open: position !== null, openAt, close };
}

export function CursorMenu({
  state,
  children,
  width = 180,
}: {
  state: CursorMenuState;
  children: ReactNode;
  width?: number;
}) {
  return (
    <DropdownMenu
      open={state.open}
      onOpenChange={(next) => {
        if (!next) state.close();
      }}
    >
      <DropdownMenuTrigger asChild>
        {/* 锚点：始终挂在树上（Radix 需要它来定位），0×0 且 pointer-events:none，
            因此左键点不到，不会重现「左键也开菜单」。 */}
        <span
          aria-hidden
          className="pointer-events-none fixed"
          style={{ left: state.position?.x ?? 0, top: state.position?.y ?? 0, width: 0, height: 0 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={2}
        className={ASSET_MENU_PANEL_CLASS}
        style={{ width }}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
