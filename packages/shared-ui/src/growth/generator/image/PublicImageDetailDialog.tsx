'use client';

import { useEffect, useState } from 'react';
import { Copy, Download, Ellipsis, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  galleryActions,
  galleryErrorMessage,
  publicGeneratorActions,
  useAuthStore,
} from '@autix/shared-store';
import type { PublicImageHistoryImage, PublicImageHistoryItem } from './public-image-generation';
import { formatImageSizeLabel } from './image-aspect';
import { downloadImageFile, formatGenerationTime } from './image-history-media';
import { galleryPostActions } from './gallery-interaction-model';
import { publishSelectionsToGallery } from './publish-to-gallery';
import { DeleteGenerationsDialog } from './DeleteGenerationsDialog';
import { ImageActionMenu } from './ImageActionMenu';
import { buildImageActionMenuItems } from './image-action-items';
import { resolveGalleryShareUrl } from './gallery-share-link';
import { useLocalizePath } from '../../../navigation';
import { DetailPanelButton, MediaDetailShell, type MediaDetailRow } from '../../detail/MediaDetailShell';

export function PublicImageDetailDialog({
  item,
  locale,
  onClose,
  onRecreate,
  onUseAsReference,
  onActiveImageChange,
  onHistoryChanged,
}: {
  item: PublicImageHistoryItem | null;
  locale: string;
  onClose: () => void;
  onRecreate?: (item: PublicImageHistoryItem) => void;
  /** 把这张图塞回输入框当参考图。缺省则不渲染 Reference 按钮。 */
  onUseAsReference?: (image: PublicImageHistoryImage) => void;
  /** 当前正在看的是哪一张（多图生成时会随缩略图切换）——列表据此标「最后查看」。 */
  onActiveImageChange?: (item: PublicImageHistoryItem, image: PublicImageHistoryImage) => void;
  onHistoryChanged?: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const localize = useLocalizePath();
  const user = useAuthStore((state) => state.user);
  const [activeImage, setActiveImage] = useState<PublicImageHistoryImage | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [posting, setPosting] = useState(false);

  const images = item?.images ?? [];
  const image = activeImage ?? images[0] ?? null;
  const prompt = image?.prompt ?? item?.prompt ?? '';
  const post = item?.galleryPost;
  const actions = galleryPostActions(post?.status);
  const deletable = actions.canDeleteGeneration;
  const authorName = user?.realName || user?.username || t('unknownAuthor');

  useEffect(() => {
    if (!item) return;
    setActiveImage(item.images[0] ?? null);
  }, [item]);

  /**
   * 帖级动作。四条出边对应后端状态机（gallery.helpers.ts TRANSITIONS）：
   * PENDING→REMOVED（撤回）、PUBLISHED→UNPUBLISHED（下架）、
   * REJECTED|UNPUBLISHED→PENDING（重新提交）、REJECTED|UNPUBLISHED|HIDDEN→REMOVED（删帖）。
   */
  const runPostAction = async (action: 'withdraw' | 'unpublish' | 'republish' | 'removePost') => {
    if (!post || posting) return;
    setPosting(true);
    try {
      if (action === 'withdraw' || action === 'removePost') await galleryActions.remove(post.id);
      else if (action === 'unpublish') await galleryActions.unpublish(post.id);
      else await galleryActions.republish(post.id);
      toast.success(t('postActionDoneToast'));
      onHistoryChanged?.();
      onClose();
    } catch (err) {
      toast.error(galleryErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  /** 一键发布：不再弹分类/参考图选择框，直接投稿（参考图随帖公开，见 publish-to-gallery）。 */
  const publishNow = async () => {
    if (!item || !image || publishing) return;
    setPublishing(true);
    try {
      const { succeeded, failed, firstError } = await publishSelectionsToGallery([{ item, image }]);
      if (succeeded === 0) {
        toast.error(galleryErrorMessage(firstError));
        return;
      }
      if (failed === 0) toast.success(t('publishSubmittedToast', { count: succeeded }));
      else toast.warning(t('publishPartialFailedToast', { succeeded, failed }));
      onHistoryChanged?.();
      onClose();
    } finally {
      setPublishing(false);
    }
  };

  const confirmDelete = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await publicGeneratorActions.deleteImageHistory(item.id);
      toast.success(t('deletedToast', { count: 1 }));
      onHistoryChanged?.();
      onClose();
    } catch {
      toast.error(t('deleteBlockedToast'));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (!item) return null;

  const quality = typeof item.settings.quality === 'string' ? item.settings.quality : undefined;
  const details: MediaDetailRow[] = [
    { label: t('model'), value: item.model || t('auto') },
    ...(quality ? [{ label: t('quality'), value: quality }] : []),
    { label: t('imageSize'), value: formatImageSizeLabel(item.settings) ?? '-' },
    { label: t('imageCount'), value: String(images.length) },
    { label: t('createdAt'), value: formatGenerationTime(item.createdAt, locale) },
  ];

  return (
    <>
      <MediaDetailShell
        open
        onClose={onClose}
        mediaUrl={image?.url ?? null}
        mediaAlt={prompt || t('prompt')}
        author={{ name: authorName, avatarUrl: user?.avatar }}
        authorSubtitle={t('author')}
        prompt={prompt}
        details={details}
        mediaOverlay={
          // 多图生成才有的候选缩略图（单图时不渲染）
          images.length > 1 ? (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2 rounded-xl bg-[rgba(35,38,42,0.75)] p-2 backdrop-blur-md">
              {images.map((candidate) => (
                <button
                  key={`${candidate.generationId ?? item.id}-${candidate.index}`}
                  type="button"
                  onClick={() => {
                    setActiveImage(candidate);
                    onActiveImageChange?.(item, candidate);
                  }}
                  className={`size-12 cursor-pointer overflow-hidden rounded-md border transition ${
                    candidate.url === image?.url
                      ? 'border-growth-accent ring-2 ring-growth-accent/25'
                      : 'border-white/15 hover:border-white/40'
                  }`}
                >
                  <img src={candidate.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null
        }
        footer={
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <DetailPanelButton
                onClick={() => {
                  onRecreate?.(item);
                  onClose();
                }}
              >
                <Copy className="size-4" />
                {t('recreate')}
              </DetailPanelButton>
              {onUseAsReference && image ? (
                <DetailPanelButton
                  onClick={() => {
                    onUseAsReference(image);
                    toast.success(t('referenceAdded'));
                    onClose();
                  }}
                >
                  <ImageIcon className="size-4" />
                  {t('reference')}
                </DetailPanelButton>
              ) : null}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <DetailPanelButton
                onClick={() => {
                  if (image) void downloadImageFile(image.url, `image-${image.index + 1}.png`);
                }}
              >
                <Download className="size-4" />
                {t('download')}
              </DetailPanelButton>
              <ImageActionMenu
                align="end"
                items={
                  image
                    ? buildImageActionMenuItems({
                        t,
                        image,
                        actions,
                        posting: posting || publishing,
                        deletable,
                        runPostAction: (action) => void runPostAction(action),
                        onDelete: () => setDeleteOpen(true),
                        onPublish: () => void publishNow(),
                        // 站内作品分享链接：只有已发布的作品才有
                        shareUrl: resolveGalleryShareUrl(post, localize),
                        // Recreate / 参考图 / 下载在这里已经是独立按钮，菜单里不重复
                      })
                    : []
                }
                trigger={
                  <button
                    type="button"
                    aria-label={t('more')}
                    className="grid size-10 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-foreground/85 transition hover:bg-white/[0.12]"
                  >
                    <Ellipsis className="size-4" />
                  </button>
                }
              />
            </div>
          </div>
        }
      />

      <DeleteGenerationsDialog
        open={deleteOpen}
        generationCount={1}
        imageCount={images.length}
        deleting={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
