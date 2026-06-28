import { useTranslations } from 'next-intl';
import { formatCount, type FeatureItem } from '../public-pricing-helpers';

export type TFunc = ReturnType<typeof useTranslations<'publicGrowth.pricing'>>;

export function renderFeatureItem(
  item: FeatureItem,
  t: TFunc,
  creditUnit: string,
): string {
  switch (item.kind) {
    case 'points':
      return t('features.points', { count: formatCount(item.count), creditUnit });
    case 'watermark':
      return t('features.watermark');
    case 'commercial':
      return t('features.commercial');
    case 'video':
      return t('features.video', { spec: item.spec });
    case 'queue':
      return t('features.queue', {
        priority: t(('queuePriority.' + item.priority) as Parameters<TFunc>[0]),
      });
    case 'batch':
      return t('features.batch', {
        level: t(('batchGeneration.' + item.level) as Parameters<TFunc>[0]),
      });
    case 'history':
      return t('features.history', { days: item.days });
    case 'server':
      if (item.text === 'free-feature-0') return t('freeFeatures.0');
      if (item.text === 'free-feature-1') return t('freeFeatures.1');
      if (item.text === 'free-feature-2') return t('freeFeatures.2');
      if (item.text === 'creator-profile') return t('creatorProfile');
      if (item.text === 'team-workspace') return t('teamWorkspace');
      if (item.text === 'fallback') return t('fallbackFeature');
      return item.text;
  }
}
