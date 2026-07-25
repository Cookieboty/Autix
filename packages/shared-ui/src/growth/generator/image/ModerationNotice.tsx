'use client';

import { AlertCircle, Clock, EyeOff, XOctagon } from 'lucide-react';
import type { GalleryPostStatus } from './gallery-interaction-model';

/**
 * 详情弹窗里的审核状态提示卡 —— 只在作者本人打开自己的历史时可能出现，
 * 广场/首页 feed 不会看到（外层已按 galleryPost 存在与否决定要不要传入）。
 *
 * 拆成独立组件的理由：图片和视频详情弹窗共享同一段视觉/文案逻辑，如果内联到
 * MediaDetailShell 就把状态机耦合进了通用外壳；放在 detail 里又要重复两次。
 * 单独一个纯展示组件最省事。
 *
 * PUBLISHED / DRAFT / REMOVED 都不渲染 —— 已发布无需再提示，DRAFT 目前没入口进这里，
 * REMOVED 的帖子在外层的判定里也不会挂到生成记录上（activePosts 已过滤）。
 */
export function ModerationNotice({
  status,
  rejectReason,
  t,
}: {
  status: GalleryPostStatus;
  rejectReason?: string | null;
  t: (key: string) => string;
}) {
  const config = configFor(status);
  if (!config) return null;

  return (
    <section
      className={`rounded-xl border ${config.border} ${config.bg} p-3`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${config.iconBg} ${config.iconText}`}
        >
          <config.Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-bold ${config.title}`}>{t(config.titleKey)}</p>
          <p className="mt-0.5 text-[12px] leading-5 text-foreground/62">{t(config.hintKey)}</p>
          {status === 'REJECTED' && rejectReason ? (
            <div className="mt-2 rounded-md bg-black/25 p-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/42">
                {t('rejectReasonLabel')}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[13px] font-medium leading-5 text-foreground/85">
                {rejectReason}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** 各状态的视觉与文案键：PENDING 琥珀、REJECTED 红、HIDDEN 灰、UNPUBLISHED 中性。 */
function configFor(status: GalleryPostStatus) {
  switch (status) {
    case 'PENDING':
      return {
        Icon: Clock,
        titleKey: 'badgePending',
        hintKey: 'moderationPendingHint',
        border: 'border-amber-500/25',
        bg: 'bg-amber-500/[0.08]',
        iconBg: 'bg-amber-500/20',
        iconText: 'text-amber-300',
        title: 'text-amber-200',
      };
    case 'REJECTED':
      return {
        Icon: XOctagon,
        titleKey: 'badgeRejected',
        hintKey: 'moderationRejectedHint',
        border: 'border-red-500/25',
        bg: 'bg-red-500/[0.08]',
        iconBg: 'bg-red-500/20',
        iconText: 'text-red-300',
        title: 'text-red-200',
      };
    case 'HIDDEN':
      return {
        Icon: EyeOff,
        titleKey: 'badgeHidden',
        hintKey: 'moderationHiddenHint',
        border: 'border-white/12',
        bg: 'bg-white/[0.04]',
        iconBg: 'bg-white/10',
        iconText: 'text-foreground/72',
        title: 'text-foreground/85',
      };
    case 'UNPUBLISHED':
      return {
        Icon: AlertCircle,
        titleKey: 'badgeUnpublished',
        hintKey: 'moderationUnpublishedHint',
        border: 'border-white/12',
        bg: 'bg-white/[0.04]',
        iconBg: 'bg-white/10',
        iconText: 'text-foreground/72',
        title: 'text-foreground/85',
      };
    default:
      return null;
  }
}
