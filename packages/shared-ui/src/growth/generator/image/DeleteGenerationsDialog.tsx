'use client';

import { useTranslations } from 'next-intl';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';

/**
 * 删除确认。后端删的是**整条生成记录**（DELETE /image-gen/workbench/history/:id），
 * 不是单张图 —— 勾中某次生成里的一张，该次生成的全部图都会消失。文案必须如实说明，
 * 不能装作只删一张。
 *
 * 视频历史（kind='video'）复用同一个弹框，只换文案：那边一条生成恒对应一个视频，
 * 没有「连带删掉兄弟图」这回事，所以不提图片数。
 */
export function DeleteGenerationsDialog({
  open,
  generationCount,
  imageCount,
  deleting,
  onClose,
  onConfirm,
  kind = 'image',
}: {
  open: boolean;
  generationCount: number;
  imageCount: number;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  kind?: 'image' | 'video';
}) {
  const t = useTranslations('publicGrowth.generator.studio');

  if (!open) return null;

  const isVideo = kind === 'video';

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="size-4" />
            {isVideo
              ? t('deleteVideoConfirmTitle', { count: generationCount })
              : t('deleteConfirmTitle', { count: generationCount })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">
            {isVideo
              ? t('deleteVideoConfirmDescription', { count: generationCount })
              : t('deleteConfirmDescription', { count: generationCount, images: imageCount })}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={deleting}>
            {t('close')}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {t('deleteConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
