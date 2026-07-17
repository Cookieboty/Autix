'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { searchEmoji } from './emoji-data';

/**
 * Emoji 选择器：搜索框 + 网格。选中即回调并关闭。
 *
 * 用 Popover 而非 DropdownMenu：菜单的排版导航（typeahead / 方向键）会跟搜索框抢按键，
 * 而这里的主交互就是打字搜索。
 */
export function EmojiPicker({
  trigger,
  onPick,
  onClear,
}: {
  trigger: ReactNode;
  onPick: (emoji: string) => void;
  /** 清除图标，回到默认文件夹图形。 */
  onClear?: () => void;
}) {
  const t = useTranslations('publicGrowth.assets');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchEmoji(query), [query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="z-[130] w-[300px] gap-0 rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.92)] p-2 text-foreground backdrop-blur-[32px]"
      >
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground/35" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('icon.search')}
            className="h-8 w-full rounded-lg bg-white/[0.06] pl-8 pr-2 text-[13px] text-foreground outline-none placeholder:text-foreground/35"
          />
        </div>

        {results.length === 0 ? (
          <p className="py-6 text-center text-xs text-foreground/35">{t('icon.empty')}</p>
        ) : (
          <div className="grid max-h-[220px] grid-cols-7 gap-1 overflow-y-auto">
            {results.map((entry) => (
              <button
                key={entry.char}
                type="button"
                onClick={() => {
                  onPick(entry.char);
                  setOpen(false);
                }}
                className="grid size-9 place-items-center rounded-lg text-xl transition hover:bg-white/10"
              >
                {entry.char}
              </button>
            ))}
          </div>
        )}

        {onClear && (
          <button
            type="button"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-foreground/55 transition hover:bg-white/5 hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            {t('icon.reset')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
