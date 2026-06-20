'use client';

import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  Eye,
  Heart,
  Monitor,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { RuntimeBadge } from './RuntimeBadge';
import { ActivateDialog } from './ResourceDetailActivationDialog';
import {
  DetailMedia,
  DetailSection,
  Info,
  InfoLabel,
  InfoValue,
  SourceLink,
  panelStyle,
} from './ResourceDetailParts';
import { hasTemplatePrompt } from './resource-detail-presenter';
import type { ResourceDetailViewProps } from './resource-detail-types';
import { SLUG_TO_RESOURCE_TYPE, TYPE_LABEL_KEY } from './resource-utils';

export type {
  ResourceDetailAction,
  ResourceDetailActivationDialog,
  ResourceDetailItem,
  ResourceDetailSessionOption,
  ResourceDetailViewProps,
} from './resource-detail-types';

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
                  <SourceLink href={resource.originalUrl}>
                    {t('detail.viewOriginal')}
                  </SourceLink>
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
