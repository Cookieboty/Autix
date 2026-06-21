import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { AnnotationPromptMessages } from '../constants';

export function useAnnotationPromptMessages(): AnnotationPromptMessages {
  const t = useTranslations('imageStudio.annotation.prompt');
  const tPos = useTranslations('imageStudio.annotation.position');
  return useMemo(
    () => ({
      position: {
        left: tPos('left'),
        right: tPos('right'),
        top: tPos('top'),
        bottom: tPos('bottom'),
        centerHorizontal: tPos('centerHorizontal'),
        centerVertical: tPos('centerVertical'),
        full: tPos('full'),
        horizontalOnly: (vertical: string) => tPos('horizontalOnly', { vertical }),
        verticalOnly: (horizontal: string) => tPos('verticalOnly', { horizontal }),
        combined: (vertical: string, horizontal: string) =>
          tPos('combined', { vertical, horizontal }),
      },
      stripLabelSuffix: t('stripLabelSuffix'),
      noRegion: (label: string) => t('noRegion', { label }),
      singleRegion: ({ label, region }) => t('singleRegion', { label, region }),
      multiRegion: ({ label, count, regions }) =>
        t('multiRegion', { label, count, regions }),
      regionDescription: ({ position, widthPercent, heightPercent }) =>
        t('regionDescription', { position, widthPercent, heightPercent }),
      regionDescriptionWithIndex: ({ index, position, widthPercent, heightPercent }) =>
        t('regionDescriptionWithIndex', { index, position, widthPercent, heightPercent }),
    }),
    [t, tPos],
  );
}
