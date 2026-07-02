// Pure, framework-free view-model helpers for the creative canvas.
// Kept dependency-light so they can be unit-tested without a DOM.

import type {
  CanvasActionEstimate,
  CanvasActionReasonCode,
  CanvasActionType,
  CanvasNode,
} from '@autix/domain';

export function actionLabel(actionType: CanvasActionType): string {
  switch (actionType) {
    case 'image-generate':
      return '生成图片';
    case 'image-edit':
      return '局部编辑';
    case 'video-from-selection':
      return '生成视频';
    case 'storyboard-from-selection':
      return '生成分镜';
    case 'agent-chat':
      return 'AI 助手';
    case 'export':
      return '导出';
    default:
      return actionType;
  }
}

export function reasonText(code: CanvasActionReasonCode): string {
  switch (code) {
    case 'membership_required':
      return '开通会员后可生成';
    case 'needs_prompt':
      return '请选择一个 Prompt';
    case 'needs_image':
      return '请选择一张图片';
    case 'needs_two_images':
      return '请至少选择两张图片';
    case 'needs_image_or_clip':
      return '请选择图片或分镜';
    default:
      return '暂不可用';
  }
}

/** Format the cost badge shown on a billable action button. */
export function estimateBadge(estimate: CanvasActionEstimate | null): string {
  if (!estimate) return '';
  switch (estimate.kind) {
    case 'exact':
      return `预计 ${estimate.cost}`;
    case 'range':
      return `预计 ${estimate.minCost}–${estimate.maxCost}`;
    case 'metered':
      return '按用量计费';
    default:
      return '';
  }
}

export interface SelectionSummary {
  total: number;
  prompts: number;
  images: number;
  videos: number;
  storyboardClips: number;
}

export function summarizeSelection(nodes: CanvasNode[], selectedIds: string[]): SelectionSummary {
  const selected = new Set(selectedIds);
  const summary: SelectionSummary = { total: 0, prompts: 0, images: 0, videos: 0, storyboardClips: 0 };
  for (const node of nodes) {
    if (!selected.has(node.id)) continue;
    summary.total += 1;
    if (node.kind === 'prompt') summary.prompts += 1;
    else if (node.kind === 'image') summary.images += 1;
    else if (node.kind === 'video') summary.videos += 1;
    else if (node.kind === 'storyboardClip') summary.storyboardClips += 1;
  }
  return summary;
}

export type SaveIndicator = 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict';

export function saveIndicatorText(indicator: SaveIndicator): string {
  switch (indicator) {
    case 'saving':
      return '保存中…';
    case 'saved':
      return '已保存';
    case 'unsaved':
      return '未保存';
    case 'conflict':
      return '已载入最新版本';
    case 'error':
      return '保存失败，将重试';
    default:
      return '';
  }
}
