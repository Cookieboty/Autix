'use client';

import { useState } from 'react';
import { Copy, Download, Ellipsis } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  galleryActions,
  galleryErrorMessage,
  publicGeneratorActions,
  reportResourceView,
  useAuthStore,
  type DirectVideoGenerationDto,
} from '@autix/shared-store';
import { useEffect } from 'react';
import { DetailPanelButton, MediaDetailShell, type MediaDetailRow } from '../../detail/MediaDetailShell';
import { ImageActionMenu } from '../image/ImageActionMenu';
import { galleryPostActions } from '../image/gallery-interaction-model';
import { downloadImageFile, formatGenerationTime } from '../image/image-history-media';
import { resolveGalleryShareUrl } from '../image/gallery-share-link';
import { DeleteGenerationsDialog } from '../image/DeleteGenerationsDialog';
import { useLocalizePath } from '../../../navigation';
import { buildVideoActionMenuItems } from './video-action-items';
import { publishVideosToGallery, videoCover } from './video-history-model';

/**
 * /ai/video 历史详情 —— 与 /ai/image 的历史详情是**同一个外壳**（MediaDetailShell），
 * 只是把媒体区切成 video（isVideo + poster）、详情行换成视频的元信息。
 *
 * 帖级动作、发布、删除的语义与图片侧逐条对齐（同一张 gallery_posts、同一套状态机），
 * 所以状态机判定直接复用 galleryPostActions，不在这里重写一份视频版。
 */
export function PublicVideoDetailDialog({
  item,
  locale,
  onClose,
  onRecreate,
  onHistoryChanged,
}: {
  item: DirectVideoGenerationDto | null;
  locale: string;
  onClose: () => void;
  onRecreate?: (item: DirectVideoGenerationDto) => void;
  onHistoryChanged?: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const localize = useLocalizePath();
  const user = useAuthStore((state) => state.user);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [posting, setPosting] = useState(false);

  const post = item?.galleryPost;
  const actions = galleryPostActions(post?.status);
  const deletable = actions.canDeleteGeneration;
  const authorName = user?.realName || user?.username || t('unknownAuthor');

  // 浏览量上报：这条生成投过广场（且帖子还活着）时，打开详情等同于看了那篇作品
  // —— 与图片详情、广场详情记同一个 scope。没投过稿的私有生成不计。
  const postId = post?.id;
  useEffect(() => {
    if (postId) reportResourceView({ resourceType: 'GALLERY_POST', resourceId: postId, scope: 'detail' });
  }, [postId]);

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

  const publishNow = async () => {
    if (!item || publishing) return;
    setPublishing(true);
    try {
      const { succeeded, failed, firstError } = await publishVideosToGallery([item]);
      if (succeeded === 0) {
        toast.error(galleryErrorMessage(firstError));
        return;
      }
      if (failed === 0) toast.success(t('publishSubmittedVideoToast', { count: succeeded }));
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
      await publicGeneratorActions.deleteVideoHistory(item.id);
      toast.success(t('deletedVideoToast', { count: 1 }));
      onHistoryChanged?.();
      onClose();
    } catch {
      toast.error(t('deleteVideoBlockedToast'));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (!item) return null;

  const options = item.options as { ratio?: unknown; resolution?: unknown } | undefined;
  const ratio = typeof options?.ratio === 'string' ? options.ratio : undefined;
  const resolution = typeof options?.resolution === 'string' ? options.resolution : undefined;
  const details: MediaDetailRow[] = [
    { label: t('model'), value: item.model || t('auto') },
    ...(ratio ? [{ label: t('videoRatio'), value: ratio }] : []),
    ...(resolution ? [{ label: t('videoResolution'), value: resolution }] : []),
    ...(item.durationSec
      ? [{ label: t('videoDuration'), value: t('secondsValue', { seconds: Math.round(item.durationSec) }) }]
      : []),
    { label: t('createdAt'), value: formatGenerationTime(item.createdAt, locale) },
  ];

  return (
    <>
      <MediaDetailShell
        open
        onClose={onClose}
        mediaUrl={item.videoUrl}
        isVideo
        poster={videoCover(item)}
        mediaAlt={item.prompt || t('prompt')}
        author={{ name: authorName, avatarUrl: user?.avatar }}
        authorSubtitle={t('author')}
        prompt={item.prompt}
        details={details}
        ariaLabel={t('videoDetail')}
        footer={
          <div className="grid gap-2">
            <DetailPanelButton
              onClick={() => {
                onRecreate?.(item);
                onClose();
              }}
            >
              <Copy className="size-4" />
              {t('recreate')}
            </DetailPanelButton>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <DetailPanelButton
                onClick={() => {
                  if (item.videoUrl) void downloadImageFile(item.videoUrl, `video-${item.id}.mp4`);
                }}
              >
                <Download className="size-4" />
                {t('download')}
              </DetailPanelButton>
              <ImageActionMenu
                align="end"
                items={buildVideoActionMenuItems({
                  t,
                  item,
                  actions,
                  posting: posting || publishing,
                  deletable,
                  runPostAction: (action) => void runPostAction(action),
                  onDelete: () => setDeleteOpen(true),
                  onPublish: () => void publishNow(),
                  shareUrl: resolveGalleryShareUrl(post, localize),
                  // Recreate / 下载在这里已经是独立按钮，菜单里不重复
                })}
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
        imageCount={1}
        deleting={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        kind="video"
      />
    </>
  );
}
