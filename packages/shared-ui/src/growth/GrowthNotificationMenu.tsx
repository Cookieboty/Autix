'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, FileText, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore, useTaskStore, type TaskEvent } from '@autix/shared-store';
import { relativeTime } from '../format';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

/**
 * 公开页导航栏「消息通知」入口：铃铛按钮 + 下拉浮层（通知列表 / 空态）。
 *
 * 视觉与 image 页输入区的「模型下拉」保持一致：半透明玻璃面板 + 青光晕 + 悬浮行高亮。
 * 数据源沿用既有 task-event「消息通知接口」（useTaskStore → /api/tasks/history、
 * /api/tasks/:id/read、SSE /api/sse/tasks）。公开页 layout 未挂 TaskSseProvider，
 * 故这里在登录态下自行拉一次历史，并在每次打开面板时刷新（不接 SSE，避免公开页常驻长连接）。
 */
export function GrowthNotificationMenu({ compact = false }: { compact?: boolean } = {}) {
  const t = useTranslations('publicGrowth.notifications');
  const tNotification = useTranslations('notification');
  const [open, setOpen] = useState(false);

  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const events = useTaskStore((state) => state.events);
  const markReadRemote = useTaskStore((state) => state.markReadRemote);
  const loadHistory = useTaskStore((state) => state.loadHistory);

  const unreadCount = events.filter((event) => !event.readAt).length;

  // 登录态确定后拉一次历史（公开页无 TaskSseProvider 兜底）。
  useEffect(() => {
    if (hydrated && isAuthenticated) void loadHistory();
  }, [hydrated, isAuthenticated, loadHistory]);

  // 未 hydrate / 未登录：不渲染入口（通知是登录用户维度的能力）。
  if (!hydrated || !isAuthenticated) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void loadHistory();
  };

  const handleItemClick = async (event: TaskEvent) => {
    if (event.readAt) return;
    try {
      await markReadRemote(event.taskId);
    } catch (err) {
      console.error('[GrowthNotificationMenu] markTaskRead failed:', err);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('title')}
          className={`growth-nav-btn relative grid place-items-center text-[#737475] transition-all duration-300 hover:text-white ${
            compact ? 'size-7' : 'size-9'
          }`}
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-h-[15px] min-w-[15px] place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="relative w-[340px] gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.86)] p-0 text-foreground backdrop-blur-[32px]"
      >
        {/* 泛青发光：顶部 + 下部各一团模糊青光（与模型下拉一致） */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-9 rounded-full blur-[50px]"
          style={{ background: 'rgba(139, 213, 244, 0.24)' }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[35%] h-9 rounded-full blur-[50px]"
          style={{ background: 'rgba(139, 213, 244, 0.24)' }}
        />
        <div className="relative">
          <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
            <span className="text-sm font-semibold text-foreground">{t('title')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('close')}
              className="grid size-6 cursor-pointer place-items-center rounded-full text-foreground/45 transition hover:bg-white/10 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* 通知列表 / 空态（带最小高度，空态时也保持面板体量） */}
          <div className="min-h-[220px] max-h-[360px] overflow-y-auto px-1.5 pb-1.5">
            {events.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
                <div className="grid size-11 place-items-center rounded-full border border-white/8 bg-white/5">
                  <Bell className="size-5 text-foreground/45" />
                </div>
                <p className="text-[13px] text-foreground/45">{t('empty')}</p>
              </div>
            ) : (
              events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => handleItemClick(event)}
                  disabled={!!event.readAt}
                  className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition disabled:cursor-default ${
                    event.readAt ? 'opacity-55' : 'cursor-pointer hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/5">
                    <FileText className="size-4 text-foreground/50" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {event.message || tNotification('taskNotification')}
                      </span>
                      {!event.readAt ? (
                        <span className="size-2 shrink-0 rounded-full bg-growth-accent" />
                      ) : (
                        <Check className="size-4 shrink-0 text-foreground/35" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-foreground/45">
                      {relativeTime(event.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
