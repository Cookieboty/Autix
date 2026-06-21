'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  AnnotationTarget,
  ImageStudioReference,
  ReferenceAnnotation,
  UploadedReference,
} from '../constants';
import { resolveReferenceAnnotationKey } from '../constants';
import { ReferenceThumb } from '../cards/ImageTemplateCard';

export function ImageStudioReferencesPanel({
  selectedSourceImages,
  uploadedRefs,
  referenceAnnotations,
  onPreview,
  onAnnotate,
  onRemoveSourceImage,
  onRemoveUploadedRef,
  onClearAll,
}: {
  selectedSourceImages: ImageStudioReference[];
  uploadedRefs: UploadedReference[];
  referenceAnnotations: Record<string, ReferenceAnnotation>;
  onPreview: (url: string, prompt?: string) => void;
  onAnnotate: (target: AnnotationTarget) => void;
  onRemoveSourceImage: (image: ImageStudioReference, index: number) => void;
  onRemoveUploadedRef: (ref: UploadedReference, index: number) => void;
  onClearAll: () => void;
}) {
  const t = useTranslations('imageStudio');
  if (selectedSourceImages.length === 0 && uploadedRefs.length === 0) return null;

  const editSourceLabel = t('panel.refSection.editSourceLabel');
  const editSourceAnnotationLabel = t('panel.refSection.editSourceAnnotation');
  const uploadedAnnotationSuffix = t('panel.refSection.uploadedAnnotationSuffix');

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{t('reference.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('reference.subtitle')}</p>
        </div>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
          onClick={onClearAll}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {selectedSourceImages.map((image, index) => {
          const annotationKey = resolveReferenceAnnotationKey(image, index);
          return (
            <ReferenceThumb
              key={annotationKey}
              url={image.url}
              label={editSourceLabel}
              annotationOverlayUrl={referenceAnnotations[annotationKey]?.overlayUrl}
              onPreview={() => onPreview(image.url, image.prompt)}
              onAnnotate={() =>
                onAnnotate({
                  url: image.url,
                  prompt: image.prompt,
                  label: `${editSourceAnnotationLabel} #${index + 1}`,
                  annotationKey,
                  overlayUrl: referenceAnnotations[annotationKey]?.overlayUrl,
                })
              }
              onRemove={() => onRemoveSourceImage(image, index)}
            />
          );
        })}
        {uploadedRefs.map((ref, index) => {
          const annotationKey = resolveReferenceAnnotationKey(ref, index);
          return (
            <ReferenceThumb
              key={annotationKey}
              url={ref.url}
              label={ref.label}
              annotationOverlayUrl={referenceAnnotations[annotationKey]?.overlayUrl}
              onPreview={() => onPreview(ref.url)}
              onAnnotate={() =>
                onAnnotate({
                  url: ref.url,
                  label: `${ref.label} #${index + 1}${uploadedAnnotationSuffix}`,
                  annotationKey,
                  overlayUrl: referenceAnnotations[annotationKey]?.overlayUrl,
                })
              }
              onRemove={() => onRemoveUploadedRef(ref, index)}
            />
          );
        })}
      </div>
    </section>
  );
}
