'use client';

import { useRef, useState, type ReactNode } from 'react';
import { LayoutGrid, Video, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ModelConfigItem } from '@autix/shared-store';
import { ModelVendorIcon } from '../brand';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { resolveModelDescription } from './generator/model-description';
import { NavFlyoutRow } from './NavFlyoutRow';
import {
  VIDEO_NAV_FEATURES,
  useVideoNavModels,
  videoModelHref,
  type VideoNavFeatureKey,
} from './video-nav';

function isPremium(model: ModelConfigItem) {
  return (model.allowedMembershipLevels?.length ?? 0) > 0;
}

/** Features 各项对应的图标（文案/顺序在共享的 VIDEO_NAV_FEATURES 里定义） */
const FEATURE_ICONS: Record<VideoNavFeatureKey, LucideIcon> = {
  createVideo: Video,
  gallery: LayoutGrid,
};

/**
 * 导航「Video」悬浮下拉：点击照常进入 /ai/video；悬浮弹出 Features（Create / Gallery）
 * + 全部视频模型列表。点击模型带 `?model=<模型名>`（空格转下划线）跳转并预选该模型。
 *
 * 与 ImageNavFlyout 同构，仅数据源与跳转地址不同；行渲染共用 NavFlyoutRow。
 *
 * children 为原本的导航 Link（作为定位锚点与 hover 触发区）。
 */
export function VideoNavFlyout({ children }: { children: ReactNode }) {
  const t = useTranslations('publicGrowth.videoNavFlyout');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const models = useVideoNavModels();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openOnHover = () => {
    cancelClose();
    setOpen(true);
  };
  const closeOnHover = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };
  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span
          className="relative inline-flex shrink-0"
          onMouseEnter={openOnHover}
          onMouseLeave={closeOnHover}
        >
          {children}
        </span>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={10}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onMouseEnter={cancelClose}
        onMouseLeave={closeOnHover}
        className="relative w-[340px] gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.86)] p-0 text-foreground backdrop-blur-[32px]"
      >
        {/* 与消息通知下拉一致的玻璃容器：顶部 + 下部各一团模糊青光 */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-9 rounded-full blur-[50px]"
          style={{ background: 'rgba(139, 213, 244, 0.24)' }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[35%] h-9 rounded-full blur-[50px]"
          style={{ background: 'rgba(139, 213, 244, 0.24)' }}
        />
        <div className="relative max-h-[min(72vh,620px)] overflow-y-auto px-1.5 pb-1.5">
          {/* Features */}
          <div className="px-2.5 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">
            {t('features')}
          </div>
          {VIDEO_NAV_FEATURES.map((feature) => {
            const Icon = FEATURE_ICONS[feature.key];
            return (
              <NavFlyoutRow
                key={feature.key}
                href={feature.href}
                icon={<Icon className="size-5" />}
                title={t(feature.key)}
                desc={t(`${feature.key}Desc`)}
                onNavigate={close}
              />
            );
          })}

          {/* Models */}
          <div className="px-2.5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-foreground/40">
            {t('models')}
          </div>
          {models.length === 0 ? (
            <div className="px-2.5 py-6 text-center text-[13px] text-foreground/40">
              {t('loading')}
            </div>
          ) : (
            models.map((model) => (
              <NavFlyoutRow
                key={model.id}
                href={videoModelHref(model.name)}
                // 默认灰度弱化，悬浮该行时恢复厂商品牌彩色
                icon={
                  <ModelVendorIcon
                    model={model}
                    className="size-5 opacity-80 grayscale transition duration-200 group-hover:opacity-100 group-hover:grayscale-0"
                  />
                }
                title={model.name}
                desc={resolveModelDescription(model, locale)}
                badge={
                  isPremium(model) ? (
                    <span className="shrink-0 rounded bg-growth-accent px-1.5 py-0.5 text-[10px] font-black uppercase italic text-background">
                      Premium
                    </span>
                  ) : undefined
                }
                onNavigate={close}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
