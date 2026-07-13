'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Share2 } from 'lucide-react';
import { galleryActions, galleryErrorMessage } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { Checkbox } from '../../../ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Label } from '../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import type { PublicImageHistoryImage, PublicImageHistoryItem } from './public-image-generation';

/** 与后端 CreateGalleryPostDto category 语义对齐的固定分类集——复用 categoryOptions 命名空间的既有译文。 */
const CATEGORY_KEYS = [
  'portrait',
  'landscape',
  'product',
  'illustration',
  'architecture',
  'scifi',
  'scene',
] as const;

export interface PublishSelection {
  item: PublicImageHistoryItem;
  image: PublicImageHistoryImage;
}

/**
 * 发布到广场弹层（Plan C Task 12 Step 3）：批量把选中的历史生成图投稿到 gallery_posts
 * （FROM_GENERATION + imageGenerationId=image.generationId，先审后发 → PENDING，不会立即
 * 出现在广场）。mediaUrls/coverImage 由服务端从生成记录派生，无需前端携带。
 */
export function PublishToGalleryDialog({
  open,
  selections,
  onClose,
  onPublished,
}: {
  open: boolean;
  selections: PublishSelection[];
  onClose: () => void;
  onPublished?: (count: number) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tCategory = useTranslations('categoryOptions');
  const [category, setCategory] = useState<string>(CATEGORY_KEYS[0]);
  const [allowPublicReference, setAllowPublicReference] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const count = selections.length;

  const handleSubmit = async () => {
    if (count === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let succeeded = 0;
      for (const { item, image } of selections) {
        await galleryActions.publish({
          kind: 'IMAGE',
          category,
          title: (image.prompt ?? item.prompt)?.slice(0, 60) || undefined,
          sourceType: 'FROM_GENERATION',
          imageGenerationId: image.generationId,
          allowPublicReference,
        });
        succeeded += 1;
      }
      onPublished?.(succeeded);
      onClose();
    } catch (err) {
      setError(galleryErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4" />
            {t('publishToGalleryTitle', { count })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('publishToGalleryDescription')}</p>

          <div className="space-y-1.5">
            <Label htmlFor="gallery-publish-category">{t('publishCategoryLabel')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="gallery-publish-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {tCategory(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-secondary/40 p-3">
            <Checkbox
              checked={allowPublicReference}
              onCheckedChange={(checked) => setAllowPublicReference(checked === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="block font-medium text-foreground">{t('allowPublicReferenceLabel')}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t('allowPublicReferenceHint')}
              </span>
            </span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            {t('close')}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || count === 0}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
            {t('publishConfirm', { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
