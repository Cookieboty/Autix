'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';

export type ImageActionMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  /** 该项之上画一条分隔线（分组用）。 */
  separatorBefore?: boolean;
  /** 有子项则渲染成二级菜单（悬浮展开），此时 onSelect 忽略。 */
  children?: ImageActionMenuItem[];
  onSelect?: () => void;
};

/** 菜单面板外壳：一级和二级共用同一套玻璃底 —— 生成器里的下拉只有一种长相。 */
const PANEL_CLASS =
  'z-[130] w-56 gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.86)] p-1.5 text-foreground backdrop-blur-[32px]';

const ITEM_CLASS =
  'flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';

/**
 * 图片操作下拉（历史卡片悬浮态 / 详情弹窗的「更多」）。
 *
 * 样式与输入框那排参数/模型下拉（ImageOptionParamMenu）一致。这里只负责「画菜单」，
 * 每一项做什么由调用方给（items），组件内不放业务分支。
 *
 * z-[130] 必须盖过详情弹窗的 z-[120]：PopoverContent 默认 z-50，portal 到 body 之后
 * 会被整个弹窗遮住——表现就是「点了更多没反应」。
 */
export function ImageActionMenu({
  trigger,
  items,
  align = 'end',
}: {
  trigger: ReactNode;
  items: ImageActionMenuItem[];
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        // 历史卡片里这个菜单浮在图片上，点选项不该冒泡到「打开详情」
        onClick={(event) => event.stopPropagation()}
        className={PANEL_CLASS}
      >
        {items.map((item) => (
          <MenuRow key={item.key} item={item} onDone={() => setOpen(false)} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

function MenuRow({ item, onDone }: { item: ImageActionMenuItem; onDone: () => void }) {
  return (
    <>
      {item.separatorBefore ? <div className="my-1.5 h-px bg-white/10" /> : null}
      {item.children?.length ? (
        <SubMenuRow item={item} onDone={onDone} />
      ) : (
        <button
          type="button"
          disabled={item.disabled}
          onClick={(event) => {
            event.stopPropagation();
            item.onSelect?.();
            onDone();
          }}
          className={`${ITEM_CLASS} ${
            item.destructive
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-foreground/82 hover:bg-white/[0.04]'
          }`}
        >
          {item.icon ? <span className="shrink-0 text-foreground/70">{item.icon}</span> : null}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </button>
      )}
    </>
  );
}

/** 二级菜单：悬浮展开在右侧（鼠标移出整块区域才收起，否则移向子菜单的路上就关了）。 */
function SubMenuRow({ item, onDone }: { item: ImageActionMenuItem; onDone: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={item.disabled}
            onClick={(event) => event.stopPropagation()}
            className={`${ITEM_CLASS} ${
              open ? 'bg-white/[0.06] text-foreground' : 'text-foreground/82 hover:bg-white/[0.04]'
            }`}
          >
            {item.icon ? <span className="shrink-0 text-foreground/70">{item.icon}</span> : null}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <ChevronRight className="size-4 shrink-0 text-foreground/45" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          // 二级菜单挂在一级菜单的 hover 区里，鼠标从父项移过来时不能关
          onOpenAutoFocus={(event) => event.preventDefault()}
          onClick={(event) => event.stopPropagation()}
          className={PANEL_CLASS}
        >
          {item.children?.map((child) => (
            <MenuRow key={child.key} item={child} onDone={onDone} />
          ))}
        </PopoverContent>
      </div>
    </Popover>
  );
}
