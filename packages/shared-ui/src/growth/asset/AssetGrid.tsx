'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Check, Ellipsis, ImageIcon, Minus, Play } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { MaterialAsset, MaterialFolder } from '@autix/shared-store';
import type { TemplateDensity } from '../generator/generator-studio-helpers';
import { groupAssetsByDate, toggleGroupSelection, type AssetDateGroup } from './asset-grid-model';
import { AssetCardMenu } from './AssetCardMenu';
import { useCursorMenu } from './CursorMenu';
import { useMarqueeSelection } from './useMarqueeSelection';

/**
 * /asset 素材网格：按日期分组，组内是等大正方形卡片。
 *
 * 与 /ai/image 历史的 justified 行布局刻意不同 —— 那边追求「按真实比例铺满整行」，
 * 这边是固定方格容器、素材在格子里居中。列数交给 CSS grid auto-fill，
 * 不需要 ResizeObserver 量宽度。
 */

/**
 * 密度档位 → 方卡最小边长（px）；normal（默认档）= 264。
 * auto-fill 据此决定列数，剩余空间由 1fr 均摊——所以实际边长 ≥ 该值，
 * 不会在行尾留一条空白。
 */
const DENSITY_CARD_MIN: Record<TemplateDensity, number> = {
  xrelaxed: 420,
  relaxed: 340,
  normal: 264,
  dense: 200,
  xdense: 150,
};

const GRID_GAP = 12;

/** 触底预留：滚动到距底部这个距离时就预取下一页，避免用户真的撞到底才等。 */
const LOAD_MORE_THRESHOLD = 600;

/** 素材在方卡里的呈现方式：contain=按最长边完整展示（默认）；cover=铺满方卡。 */
export type AssetFitMode = 'contain' | 'cover';

/** 右键菜单里除 asset/state 之外的入参，从 AssetLibraryView 一路透传到每张卡。 */
type AssetCardMenuProps = {
  folders: MaterialFolder[];
  pendingFolderId: string | null;
  onOpen: (asset: MaterialAsset) => void;
  onDownload: (asset: MaterialAsset) => void;
  onToggleFolder: (asset: MaterialAsset, folder: MaterialFolder, next: boolean) => void;
  onCreateFolder: (asset: MaterialAsset, name: string) => Promise<boolean>;
  onDelete: (asset: MaterialAsset) => void;
};

function AssetCard({
  asset,
  fit,
  selected,
  selectionActive,
  onOpen,
  onToggleSelect,
  menuProps,
  registerRef,
  shouldSuppressClick,
}: {
  asset: MaterialAsset;
  fit: AssetFitMode;
  selected: boolean;
  selectionActive: boolean;
  onOpen: (asset: MaterialAsset) => void;
  onToggleSelect: (asset: MaterialAsset) => void;
  menuProps: AssetCardMenuProps;
  registerRef: (el: HTMLElement | null) => void;
  shouldSuppressClick: () => boolean;
}) {
  const t = useTranslations('publicGrowth.assets');
  const isVideo = asset.type === 'video';
  const preview = asset.thumbnailUrl || asset.url;
  const menu = useCursorMenu();

  return (
    <div
      ref={registerRef}
      data-asset-card=""
      onContextMenu={menu.openAt}
      // 选中态与 /ai/image 历史一致：3px 纯白粗边，不用主题色。
      // overflow-hidden 只裁图片，不裁菜单：菜单走 portal 渲染到 body，不受这里影响。
      className={`group relative aspect-square overflow-hidden rounded-xl border-solid border-white bg-[rgb(28,30,32)] transition-all duration-75 ${
        selected ? 'border-[3px]' : 'border-0'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          // 框选松手后浏览器仍会派发一次 click——不吞掉的话会顺手打开详情。
          if (shouldSuppressClick()) return;
          if (selectionActive) onToggleSelect(asset);
          else onOpen(asset);
        }}
        className="block size-full cursor-pointer"
        aria-label={asset.title}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={asset.title}
            loading="lazy"
            className={`size-full transition duration-300 ${
              fit === 'cover' ? 'object-cover group-hover:scale-[1.02]' : 'object-contain'
            }`}
          />
        ) : (
          <div className="grid size-full place-items-center text-foreground/25">
            <ImageIcon className="size-6" />
          </div>
        )}
      </button>

      {isVideo && !selectionActive && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-9 place-items-center rounded-full bg-black/45 backdrop-blur">
            <Play className="size-4 translate-x-[1px] fill-white text-white" />
          </span>
        </div>
      )}

      {/* 勾选框：hover 或已选中时才显形，避免网格常态被一堆方块污染。
          三态与 /ai/image 历史逐一对齐（白底选中 / 多选态常驻 / 常态仅 hover）。 */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelect(asset);
        }}
        aria-label={asset.title}
        aria-pressed={selected}
        className={`absolute left-2 top-2 z-30 grid size-[18px] place-items-center rounded-[7px] border transition ${
          selected
            ? 'border-white bg-white text-background opacity-100'
            : selectionActive
              ? 'border-white/55 bg-background/35 text-transparent opacity-100 backdrop-blur'
              : 'border-white/70 bg-background/45 text-transparent opacity-0 backdrop-blur group-hover:opacity-100'
        }`}
      >
        <Check className="size-3" strokeWidth={3} />
      </button>

      {/* 悬浮「更多」：与右键同一个菜单，只是锚点取按钮自身位置而非鼠标位置。
          不另起一套菜单——两个入口行为必须一致。 */}
      {!selectionActive && (
        <button
          type="button"
          aria-label={t('card.more')}
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            menu.openAt({
              preventDefault: () => {},
              clientX: rect.right,
              clientY: rect.bottom + 4,
            });
          }}
          className="absolute right-2 top-2 grid size-6 place-items-center rounded-lg bg-black/45 text-white/85 opacity-0 backdrop-blur transition hover:bg-black/65 hover:text-white group-hover:opacity-100"
        >
          <Ellipsis className="size-3.5" />
        </button>
      )}

      <AssetCardMenu asset={asset} state={menu} {...menuProps} />
    </div>
  );
}

export function AssetGrid({
  assets,
  density,
  fit,
  loadingMore,
  hasMore,
  onLoadMore,
  onOpen,
  selected,
  onSelectedChange,
  menuProps,
}: {
  assets: MaterialAsset[];
  density: TemplateDensity;
  fit: AssetFitMode;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpen: (asset: MaterialAsset) => void;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  menuProps: AssetCardMenuProps;
}) {
  const t = useTranslations('publicGrowth.assets');
  const format = useFormatter();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const marquee = useMarqueeSelection({ selected, onSelectedChange });

  const groups = useMemo(() => groupAssetsByDate(assets), [assets]);

  // 触底预取：IntersectionObserver 盯住列表尾部的哨兵。
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: `${LOAD_MORE_THRESHOLD}px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  const toggleOne = useCallback(
    (asset: MaterialAsset) => {
      const next = new Set(selected);
      if (next.has(asset.id)) next.delete(asset.id);
      else next.add(asset.id);
      onSelectedChange(next);
    },
    [onSelectedChange, selected],
  );

  const toggleGroup = useCallback(
    (group: AssetDateGroup) => onSelectedChange(toggleGroupSelection(selected, group)),
    [onSelectedChange, selected],
  );

  const formatGroupLabel = (key: string) => {
    if (key === 'unknown') return t('unknownDate');
    const [year, month, day] = key.split('-').map(Number);
    if (!year || !month || !day) return key;
    return format.dateTime(new Date(year, month - 1, day), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="relative flex select-none flex-col gap-7" onMouseDown={marquee.onMouseDown}>
      {groups.map((group) => {
        const ids = group.assets.map((asset) => asset.id);
        const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
        // 半选：选了一部分但没全选——日期勾选框画横杠。
        const someSelected = !allSelected && ids.some((id) => selected.has(id));

        return (
          <section key={group.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5" data-asset-card="">
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                aria-checked={allSelected ? 'true' : someSelected ? 'mixed' : 'false'}
                role="checkbox"
                aria-label={formatGroupLabel(group.key)}
                // 与卡片勾选框同一套外观（size-[18px] / rounded-[7px] / 白底选中）。
                // 半选：组内选了一部分——画一横杠而不是勾，否则和「全选」分不出来。
                className={`grid size-[18px] place-items-center rounded-[7px] border transition ${
                  allSelected || someSelected
                    ? 'border-white bg-white text-background'
                    : 'border-white/55 bg-background/35 text-transparent backdrop-blur hover:border-white/80'
                }`}
              >
                {someSelected ? (
                  <Minus className="size-3" strokeWidth={3} />
                ) : (
                  <Check className="size-3" strokeWidth={3} />
                )}
              </button>
              <h2 className="text-sm font-semibold text-foreground">
                {formatGroupLabel(group.key)}
              </h2>
            </div>

            <div
              className="grid"
              style={{
                gap: GRID_GAP,
                gridTemplateColumns: `repeat(auto-fill, minmax(${DENSITY_CARD_MIN[density]}px, 1fr))`,
              }}
            >
              {group.assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  fit={fit}
                  selected={selected.has(asset.id)}
                  selectionActive={selected.size > 0}
                  onOpen={onOpen}
                  onToggleSelect={toggleOne}
                  menuProps={menuProps}
                  registerRef={(el) => marquee.registerCard(asset.id, el)}
                  shouldSuppressClick={marquee.shouldSuppressClick}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* 框选矩形：fixed + 视口坐标，与命中判定用的 getBoundingClientRect 同一参照系。 */}
      {marquee.rect && (
        <div
          className="pointer-events-none fixed z-40 rounded-md border border-white/80 bg-white/30"
          style={marquee.rect}
        />
      )}

      <div ref={sentinelRef} className="h-px" />
      {loadingMore && (
        <p className="py-4 text-center text-xs text-foreground/40">{t('loadingMore')}</p>
      )}
    </div>
  );
}
