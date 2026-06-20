'use client';

import { useTranslations } from 'next-intl';
import type { ConversationKind } from '@autix/shared-store';
import { cn } from '../ui/utils';
import {
  conversationKindLabel,
  isTemplateSessionCompatible,
  templateCompatibleTargetLabel,
  templateSessionMismatchMessage,
} from './resource-detail-presenter';
import type {
  DetailVisualVariant,
  ResourceDetailActivationDialog as ResourceDetailActivationDialogProps,
  ResourceDetailSessionOption,
} from './resource-detail-types';
import { panelStyle } from './ResourceDetailParts';

export function ActivateDialog({
  sessions,
  onSelect,
  onClose,
  applying = false,
  error,
  resourceType,
  onError,
  mode = 'simple',
  variant,
}: ResourceDetailActivationDialogProps & { variant: DetailVisualVariant }) {
  const t = useTranslations('marketplace');
  const isImmersive = variant === 'immersive';
  const isTemplateMode = mode === 'template';
  const conversationKindLabels: Record<ConversationKind, string> = {
    video: t('detail.conversationKind.video'),
    image: t('detail.conversationKind.image'),
    avatar: t('detail.conversationKind.avatar'),
    chat: t('detail.conversationKind.chat'),
  };
  const compatibleTargets = {
    imageTemplate: t('detail.compatibleTarget.imageTemplate'),
    videoTemplate: t('detail.compatibleTarget.videoTemplate'),
    defaultTarget: t('detail.compatibleTarget.default'),
  };
  const targetLabel = resourceType
    ? templateCompatibleTargetLabel(resourceType, compatibleTargets)
    : compatibleTargets.defaultTarget;

  const handleSelectSession = (session: ResourceDetailSessionOption) => {
    if (
      isTemplateMode &&
      resourceType &&
      session.kind &&
      !isTemplateSessionCompatible(resourceType, session.kind)
    ) {
      onError?.(
        templateSessionMismatchMessage(resourceType, session.kind, {
          conversationKinds: conversationKindLabels,
          compatibleTargets,
          templateSessionMismatch: t('detail.templateSessionMismatch'),
        }),
      );
      return;
    }
    onError?.(null);
    void onSelect(session.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => {
        if (!applying) onClose();
      }}
    >
      <div
        className={cn(
          'w-[420px] max-w-[calc(100vw-2rem)] space-y-4 rounded-lg p-6',
          isImmersive
            ? 'border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,17,31,0.96))] text-white shadow-2xl backdrop-blur-xl'
            : '',
        )}
        style={panelStyle(variant)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(isTemplateMode && 'space-y-1')}>
          <h3
            className={cn(
              'text-base font-semibold',
              isImmersive && 'text-white',
            )}
          >
            {isTemplateMode ? t('detail.applyDialogTitle') : t('detail.activateTo')}
          </h3>
          {isTemplateMode && (
            <p className={cn('text-xs', isImmersive && 'text-white/54')}>
              {t('detail.applyDialogDescription', { target: targetLabel })}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={applying}
          onClick={() => {
            onError?.(null);
            void onSelect('new');
          }}
          className={cn(
            'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            isImmersive
              ? 'border border-white/12 bg-white/[0.055] text-white hover:bg-white/10'
              : 'hover:bg-[var(--panel-muted)]',
          )}
          style={isImmersive ? undefined : { border: '1px solid var(--border)' }}
        >
          {applying
            ? t('detail.applying')
            : isTemplateMode
              ? t('detail.createAndApply')
              : t('detail.createAndActivate')}
        </button>
        {sessions.length > 0 && (
          <div className="space-y-1">
            <div
              className={cn(
                'text-[11px] font-medium uppercase',
                isImmersive && 'text-white/48',
              )}
              style={isImmersive ? undefined : { color: 'var(--muted)' }}
            >
              {t('detail.recentSessions')}
            </div>
            {sessions.map((session) => {
              const compatible =
                !isTemplateMode ||
                !resourceType ||
                !session.kind ||
                isTemplateSessionCompatible(resourceType, session.kind);

              return (
                <button
                  key={session.id}
                  type="button"
                  disabled={applying}
                  onClick={() => handleSelectSession(session)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    isImmersive
                      ? 'text-white hover:bg-white/10'
                      : 'hover:bg-[var(--panel-muted)]',
                  )}
                >
                  <span className="min-w-0 truncate">{session.title}</span>
                  {isTemplateMode && session.kind && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px]',
                        compatible
                          ? 'border-emerald-300/30 bg-emerald-400/12 text-emerald-100'
                          : 'border-white/10 bg-white/[0.06] text-white/44',
                      )}
                    >
                      {conversationKindLabel(session.kind, conversationKindLabels)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {isTemplateMode && error && (
          <div className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
            {error}
          </div>
        )}
        <button
          type="button"
          disabled={applying}
          onClick={onClose}
          className={cn(
            'w-full py-1 text-center text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            isImmersive ? 'text-white/52 hover:text-white' : '',
          )}
          style={isImmersive ? undefined : { color: 'var(--muted)' }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
