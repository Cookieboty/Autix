'use client';

import { useMemo } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  ExternalLink,
  Eye,
  Heart,
  Monitor,
} from 'lucide-react';
import type {
  ConversationKind,
  ImageTemplate,
  VideoTemplate,
  Skill,
  McpServer,
  AgentResource,
  MarketplaceTypeSlug,
  ResourceType,
  TemplateVariable,
} from '@autix/shared-store';
import { FallbackImage } from '../template/FallbackImage';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { RuntimeBadge } from './RuntimeBadge';
import { getVideoPreviewUrl, useTimedVideoPreview } from './VideoHoverPreview';
import { SLUG_TO_RESOURCE_TYPE, TYPE_LABEL_KEY } from './resource-utils';

export type ResourceDetailItem =
  | ImageTemplate
  | VideoTemplate
  | Skill
  | McpServer
  | AgentResource;

export type ResourceDetailSessionOption = {
  id: string;
  title: string;
  kind?: ConversationKind;
};

export type ResourceDetailAction = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  onClick: () => void | Promise<void>;
};

export type ResourceDetailActivationDialog = {
  open: boolean;
  sessions: ResourceDetailSessionOption[];
  onSelect: (id: string | 'new') => void | Promise<void>;
  onClose: () => void;
  applying?: boolean;
  error?: string | null;
  resourceType?: ResourceType;
  onError?: (message: string | null) => void;
  mode?: 'simple' | 'template';
};

type DetailVisualVariant = 'immersive' | 'panel';

export type ResourceDetailViewProps = {
  slug: MarketplaceTypeSlug;
  resource: ResourceDetailItem;
  resourceType?: ResourceType;
  variant?: DetailVisualVariant;
  actions?: ResourceDetailAction[];
  activationDialog?: ResourceDetailActivationDialog;
  desktopBlocked?: boolean;
  error?: string | null;
  usageMetric?: 'viewCount' | 'useCount';
  enableVideoPreview?: boolean;
  showTemplateDetails?: boolean;
  showResourceInfo?: boolean;
  showSourceInfo?: boolean;
  onBackToList: () => void;
};

function hasTemplatePrompt(
  resource: ResourceDetailItem,
): resource is (ImageTemplate | VideoTemplate) & {
  prompt: string;
  variables: TemplateVariable[];
} {
  return 'prompt' in resource && typeof resource.prompt === 'string';
}

function conversationKindLabel(
  kind: ConversationKind,
  labels: Record<ConversationKind, string>,
) {
  switch (kind) {
    case 'video':
      return labels.video;
    case 'image':
      return labels.image;
    case 'avatar':
      return labels.avatar;
    case 'chat':
    default:
      return labels.chat;
  }
}

function templateCompatibleTargetLabel(
  type: ResourceType,
  labels: { imageTemplate: string; videoTemplate: string; defaultTarget: string },
) {
  if (type === 'IMAGE_TEMPLATE') return labels.imageTemplate;
  if (type === 'VIDEO_TEMPLATE') return labels.videoTemplate;
  return labels.defaultTarget;
}

function isTemplateSessionCompatible(type: ResourceType, kind: ConversationKind) {
  if (type === 'IMAGE_TEMPLATE') return kind === 'chat' || kind === 'image';
  if (type === 'VIDEO_TEMPLATE') return kind === 'chat';
  return true;
}

function templateSessionMismatchMessage(
  type: ResourceType,
  kind: ConversationKind,
  labels: {
    conversationKinds: Record<ConversationKind, string>;
    compatibleTargets: {
      imageTemplate: string;
      videoTemplate: string;
      defaultTarget: string;
    };
    templateSessionMismatch: string;
  },
) {
  const current = conversationKindLabel(kind, labels.conversationKinds);
  const target = templateCompatibleTargetLabel(type, labels.compatibleTargets);
  return labels.templateSessionMismatch
    .replace('{current}', current)
    .replace('{target}', target);
}

function panelStyle(variant: DetailVisualVariant) {
  if (variant === 'immersive') {
    return undefined;
  }
  return {
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
  };
}

export function ResourceDetailView({
  slug,
  resource,
  resourceType = SLUG_TO_RESOURCE_TYPE[slug],
  variant = 'immersive',
  actions = [],
  activationDialog,
  desktopBlocked = false,
  error,
  usageMetric = 'viewCount',
  enableVideoPreview = variant === 'immersive',
  showTemplateDetails = variant === 'immersive',
  showResourceInfo = variant === 'immersive',
  showSourceInfo = variant === 'immersive',
  onBackToList,
}: ResourceDetailViewProps) {
  const t = useTranslations('marketplace');
  const isImmersive = variant === 'immersive';
  const isFree = resource.pointsCost === 0;
  const metricValue =
    usageMetric === 'useCount' ? resource.useCount : resource.viewCount;

  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto',
        isImmersive
          ? 'bg-[linear-gradient(180deg,#020617_0%,#08111f_36%,var(--background)_100%)] px-4 py-5 text-white sm:px-6'
          : 'px-6 py-6',
      )}
    >
      <nav
        className={cn(
          'mb-4 flex items-center gap-2 text-sm',
          isImmersive ? 'text-white/52' : '',
        )}
        style={isImmersive ? undefined : { color: 'var(--muted)' }}
      >
        <button
          type="button"
          onClick={onBackToList}
          className={cn(isImmersive && 'transition-colors hover:text-white')}
        >
          {t(`resourceType.${TYPE_LABEL_KEY[slug]}`)}
        </button>
        <ChevronRight className={isImmersive ? 'h-3 w-3' : 'h-3 w-3'} />
        <span
          className="truncate"
          style={isImmersive ? undefined : { color: 'var(--foreground)' }}
        >
          {resource.title}
        </span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          className={cn(
            'col-span-1 overflow-hidden rounded-lg lg:col-span-7',
            isImmersive && 'border border-white/12 bg-white/[0.075] shadow-2xl backdrop-blur-xl',
          )}
          style={panelStyle(variant)}
        >
          <DetailMedia
            resource={resource}
            isVideoTemplate={resourceType === 'VIDEO_TEMPLATE'}
            enableVideoPreview={enableVideoPreview}
            variant={variant}
          />
        </div>

        <aside
          className={cn(
            'col-span-1 flex flex-col rounded-lg p-5 lg:col-span-5',
            isImmersive && 'border border-white/12 bg-white/[0.075] shadow-2xl backdrop-blur-xl',
          )}
          style={panelStyle(variant)}
        >
          <h1
            className={cn(
              'mb-1 text-xl font-bold',
              isImmersive && 'text-white',
            )}
            style={isImmersive ? undefined : { color: 'var(--foreground)' }}
          >
            {resource.title}
          </h1>
          <p
            className={cn('mb-3 text-xs', isImmersive && 'text-white/46')}
            style={isImmersive ? undefined : { color: 'var(--muted)' }}
          >
            by {resource.authorId}
          </p>

          <div className="mb-4 flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                isImmersive && (isFree ? 'bg-green-500 text-white' : 'bg-white/10 text-white'),
              )}
              style={
                isImmersive
                  ? undefined
                  : {
                      backgroundColor: isFree ? '#22c55e' : 'var(--panel-muted)',
                      color: isFree ? '#fff' : 'var(--foreground)',
                    }
              }
            >
              {isFree
                ? t('common.free')
                : t('common.pointsCost', { points: resource.pointsCost })}
            </span>
            <RuntimeBadge
              level={resource.runtimeRequirement}
              reason={resource.runtimeReason ?? null}
            />
          </div>

          {resource.description && (
            <p
              className={cn(
                'mb-4 text-sm leading-relaxed',
                isImmersive && 'text-white/62',
              )}
              style={isImmersive ? undefined : { color: 'var(--muted)' }}
            >
              {resource.description}
            </p>
          )}

          {actions.map((action, index) => (
            <Button
              key={action.id}
              type="button"
              variant={action.variant ?? 'default'}
              disabled={action.disabled}
              onClick={() => {
                void action.onClick();
              }}
              className={cn(
                'w-full',
                index > 0 && 'mt-2',
                isImmersive &&
                  (action.variant ?? 'default') === 'outline' &&
                  'border-white/16 bg-white/10 text-white hover:bg-white/16 hover:text-white',
              )}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}

          {desktopBlocked && (
            <div
              className={cn(
                'mt-3 space-y-1 text-xs',
                isImmersive
                  ? 'rounded-lg border border-white/10 bg-white/10 p-3'
                  : 'rounded p-3',
              )}
              style={isImmersive ? undefined : { backgroundColor: 'var(--panel-muted)' }}
            >
              <div
                className={cn(
                  'flex items-center gap-1 font-medium',
                  isImmersive && 'text-white',
                )}
              >
                <Monitor className="h-3 w-3" />
                {t('detail.whyDesktopOnly')}
              </div>
              <p
                className={cn(isImmersive && 'text-white/58')}
                style={isImmersive ? undefined : { color: 'var(--muted)' }}
              >
                {resource.runtimeReason ?? t('detail.localRuntimeRequired')}
              </p>
            </div>
          )}

          {error && (
            <div className={cn('mt-3 text-xs', isImmersive ? 'text-destructive' : 'text-red-500')}>
              {error}
            </div>
          )}

          <div
            className={cn(
              'mt-auto flex items-center gap-3 border-t pt-4',
              isImmersive ? 'border-white/10 text-white/54' : '',
            )}
            style={
              isImmersive
                ? undefined
                : { borderColor: 'var(--border)', color: 'var(--muted)' }
            }
          >
            <span className="flex items-center gap-1 text-xs">
              <Eye className="h-3 w-3" />
              {metricValue}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Heart className="h-3 w-3" />
              {resource.likeCount}
            </span>
          </div>
        </aside>
      </div>

      {showTemplateDetails && hasTemplatePrompt(resource) && (
        <DetailSection
          title="Prompt"
          variant={variant}
          className="mt-6"
        >
          <pre
            className={cn(
              'max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg p-4 text-xs leading-5',
              isImmersive
                ? 'border border-white/10 bg-black/28 text-white/78'
                : 'border bg-[var(--panel-muted)]',
            )}
            style={isImmersive ? undefined : { borderColor: 'var(--border)' }}
          >
            {resource.prompt}
          </pre>
          {resource.variables.length > 0 && (
            <div className="mt-4">
              <h3
                className={cn(
                  'mb-2 text-xs font-semibold',
                  isImmersive && 'text-white',
                )}
              >
                {t('detail.variableDefinitions')}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {resource.variables.map((variable) => (
                  <div
                    key={variable.key}
                    className={cn(
                      'rounded-lg px-3 py-2 text-xs',
                      isImmersive
                        ? 'border border-white/10 bg-white/[0.055]'
                        : 'border bg-[var(--panel-muted)]',
                    )}
                    style={isImmersive ? undefined : { borderColor: 'var(--border)' }}
                  >
                    <div
                      className={cn('font-medium', isImmersive && 'text-white')}
                    >
                      {variable.label}
                      <span
                        className={cn(
                          'ml-1 font-mono text-[10px]',
                          isImmersive && 'text-white/46',
                        )}
                        style={isImmersive ? undefined : { color: 'var(--muted)' }}
                      >
                        {`{{${variable.key}}}`}
                      </span>
                    </div>
                    <div
                      className={cn('mt-1', isImmersive && 'text-white/52')}
                      style={isImmersive ? undefined : { color: 'var(--muted)' }}
                    >
                      {variable.type}
                      {variable.default
                        ? t('detail.defaultValue', { value: variable.default })
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DetailSection>
      )}

      {showResourceInfo && (
        <DetailSection
          title={t('detail.resourceInfo')}
          variant={variant}
          className="mt-6"
        >
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Info
              label={t('detail.info.type')}
              value={t(`resourceType.${TYPE_LABEL_KEY[slug]}`)}
              variant={variant}
            />
            <Info
              label={t('detail.info.category')}
              value={resource.category}
              variant={variant}
            />
            <Info
              label={t('detail.info.version')}
              value={`v${resource.version}`}
              variant={variant}
            />
            <Info
              label={t('detail.info.updatedAt')}
              value={new Date(resource.updatedAt).toLocaleDateString()}
              variant={variant}
            />
          </div>
        </DetailSection>
      )}

      {showSourceInfo &&
        (resource.originalUrl ||
          resource.authorName ||
          resource.sourcePlatform ||
          resource.externalId) && (
          <DetailSection
            title={t('detail.sourceInfo')}
            variant={variant}
            className="mt-6"
          >
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              {resource.authorName && (
                <div>
                  <InfoLabel variant={variant}>{t('detail.info.author')}</InfoLabel>
                  {resource.authorUrl ? (
                    <a
                      href={resource.authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-blue-500 hover:underline"
                    >
                      {resource.authorName}
                    </a>
                  ) : (
                    <InfoValue variant={variant}>{resource.authorName}</InfoValue>
                  )}
                </div>
              )}
              {resource.sourcePlatform && (
                <Info
                  label={t('detail.info.platform')}
                  value={resource.sourcePlatform}
                  variant={variant}
                />
              )}
              {resource.externalId && (
                <Info
                  label={t('detail.info.externalId')}
                  value={resource.externalId}
                  variant={variant}
                />
              )}
              {resource.originalUrl && (
                <div>
                  <InfoLabel variant={variant}>
                    {t('detail.info.originalLink')}
                  </InfoLabel>
                  <a
                    href={resource.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                  >
                    {t('detail.viewOriginal')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </DetailSection>
        )}

      {activationDialog?.open && (
        <ActivateDialog
          {...activationDialog}
          resourceType={activationDialog.resourceType ?? resourceType}
          variant={variant}
        />
      )}
    </div>
  );
}

function DetailMedia({
  resource,
  isVideoTemplate,
  enableVideoPreview,
  variant,
}: {
  resource: ResourceDetailItem;
  isVideoTemplate: boolean;
  enableVideoPreview: boolean;
  variant: DetailVisualVariant;
}) {
  const t = useTranslations('marketplace');
  const previewUrl = useMemo(
    () => (isVideoTemplate && enableVideoPreview ? getVideoPreviewUrl(resource) : null),
    [enableVideoPreview, isVideoTemplate, resource],
  );
  const { previewRef, startPreview, stopPreview } =
    useTimedVideoPreview(previewUrl);
  const isImmersive = variant === 'immersive';

  return (
    <div
      className={cn(
        'group relative aspect-[4/3] overflow-hidden',
        isImmersive ? 'bg-black/30' : 'bg-[var(--panel-muted)]',
      )}
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      tabIndex={previewUrl ? 0 : undefined}
    >
      <FallbackImage
        src={resource.coverImage}
        alt={resource.title}
        className={cn(
          'h-full w-full object-cover transition-all duration-500',
          isImmersive && 'group-hover:scale-[1.025]',
          previewUrl && 'group-hover:opacity-0',
        )}
        fallbackText={t('common.noCover')}
      />
      {previewUrl && (
        <video
          ref={previewRef}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          src={previewUrl}
          muted
          playsInline
          preload="metadata"
          poster={resource.coverImage ?? undefined}
          onEnded={stopPreview}
          onError={stopPreview}
          onLoadedData={(event: SyntheticEvent<HTMLVideoElement>) => {
            event.currentTarget.currentTime = 0;
          }}
        />
      )}
      {isImmersive && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/18 via-transparent to-black/64" />
      )}
      {isVideoTemplate && isImmersive && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover:scale-105',
            previewUrl && 'group-hover:opacity-0',
          )}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/28 bg-white/20 text-white shadow-2xl backdrop-blur-md">
            <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-white" />
          </span>
        </div>
      )}
      {previewUrl && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/14 bg-black/40 px-3 py-1 text-xs text-white/72 backdrop-blur-md">
          {t('detail.hoverPreview')}
        </div>
      )}
    </div>
  );
}

function DetailSection({
  title,
  variant,
  className,
  children,
}: {
  title: ReactNode;
  variant: DetailVisualVariant;
  className?: string;
  children: ReactNode;
}) {
  const isImmersive = variant === 'immersive';

  return (
    <div className={className}>
      <div
        className={cn(
          'rounded-lg p-5',
          isImmersive && 'border border-white/12 bg-white/[0.075] shadow-xl backdrop-blur-xl',
        )}
        style={panelStyle(variant)}
      >
        <h2
          className={cn(
            'mb-3 text-sm font-semibold',
            isImmersive && 'text-white',
          )}
          style={isImmersive ? undefined : { color: 'var(--foreground)' }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  variant,
}: {
  label: string;
  value: ReactNode;
  variant: DetailVisualVariant;
}) {
  return (
    <div>
      <InfoLabel variant={variant}>{label}</InfoLabel>
      <InfoValue variant={variant}>{value}</InfoValue>
    </div>
  );
}

function InfoLabel({
  variant,
  children,
}: {
  variant: DetailVisualVariant;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(variant === 'immersive' && 'text-white/48')}
      style={variant === 'immersive' ? undefined : { color: 'var(--muted)' }}
    >
      {children}
    </div>
  );
}

function InfoValue({
  variant,
  children,
}: {
  variant: DetailVisualVariant;
  children: ReactNode;
}) {
  return (
    <div
      className={cn('break-all', variant === 'immersive' && 'text-white')}
      style={variant === 'immersive' ? undefined : { color: 'var(--foreground)' }}
    >
      {children}
    </div>
  );
}

function ActivateDialog({
  sessions,
  onSelect,
  onClose,
  applying = false,
  error,
  resourceType,
  onError,
  mode = 'simple',
  variant,
}: ResourceDetailActivationDialog & { variant: DetailVisualVariant }) {
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
