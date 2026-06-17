import type { ModelConfigItem } from '@autix/shared-lib';

export interface ImageStudioReference {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

export interface ImageStudioModelSettings {
  size: string;
  quality: string;
  count: number;
  guidanceScale: number;
  steps: number;
  seed: string;
  promptTuning: string;
  stylePreset: string;
  negativePrompt: string;
}

export interface ImageStudioPromptRefinement {
  originalPrompt: string;
  composedPrompt: string;
  refinedPrompt: string;
  additions: string[];
  model?: string;
  chatModel?: string;
}

export interface AnnotationTarget {
  url: string;
  prompt?: string;
  label: string;
  overlayUrl?: string;
}

export interface ImageAnnotationResult {
  targetUrl: string;
  overlayUrl: string;
  mergedUrl?: string;
  note: string;
}

export interface ReferenceAnnotation {
  overlayUrl: string;
  mergedUrl: string;
  note: string;
}

export interface UploadedReference {
  url: string;
  label: '上传参考';
}

export interface AnnotationBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MarkHistoryEntry {
  imageData: ImageData;
  bounds: AnnotationBounds | null;
}

export type InspirationTab = 'history' | 'materials' | 'templates';

export const STYLE_PRESETS = [
  '通用精修',
  '商业摄影',
  '电影感',
  '产品海报',
  '国风插画',
  '室内空间',
  '角色设定',
  '表情包',
];

export const PROMPT_TUNING_OPTIONS = [
  '自动优化',
  '忠实原文',
  '摄影级细节',
  '电商卖点',
  '故事氛围',
  '极简构图',
];

export const TEMPLATE_SORT_OPTIONS = [
  { label: '热门优先', value: 'popular' },
  { label: '最新发布', value: 'newest' },
  { label: '收藏最多', value: 'likes' },
];

export const promptToolbarControlClass =
  'inline-flex h-10 w-[150px] shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium shadow-none transition-colors';

export const ANNOTATION_COLORS = [
  { label: '红色', value: 'rgba(255, 60, 60, 0.88)', swatch: '#ff3c3c' },
  { label: '黄色', value: 'rgba(250, 204, 21, 0.9)', swatch: '#facc15' },
  { label: '青色', value: 'rgba(34, 211, 238, 0.9)', swatch: '#22d3ee' },
  { label: '绿色', value: 'rgba(74, 222, 128, 0.9)', swatch: '#4ade80' },
  { label: '紫色', value: 'rgba(168, 85, 247, 0.9)', swatch: '#a855f7' },
  { label: '白色', value: 'rgba(255, 255, 255, 0.92)', swatch: '#ffffff' },
];

export function readFilesAsDataUrls(files: File[]) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export function modelProviderLabel(model?: ModelConfigItem | null) {
  if (!model) return '未选择';
  const raw = `${model.provider} ${model.model}`.toLowerCase();
  if (raw.includes('gemini')) return 'Gemini';
  if (raw.includes('gpt') || raw.includes('openai')) return 'GPT Image';
  if (raw.includes('dall')) return 'DALL-E';
  return model.provider || model.type || 'Image';
}

export function resolveTemplatePrompt(template: {
  prompt?: string;
  variables?: Array<{ key: string; default?: string; label?: string }>;
}) {
  let nextPrompt = template.prompt ?? '';
  for (const variable of template.variables ?? []) {
    const fallback = variable.default || variable.label || variable.key;
    nextPrompt = nextPrompt.replaceAll(`{{${variable.key}}}`, fallback);
  }
  return nextPrompt.trim();
}

export function cloneAnnotationBounds(bounds: AnnotationBounds | null): AnnotationBounds | null {
  return bounds ? { ...bounds } : null;
}

export function mergeAnnotationBounds(boundsList: AnnotationBounds[]): AnnotationBounds | null {
  if (boundsList.length === 0) return null;
  return boundsList.reduce<AnnotationBounds>(
    (merged, bounds) => ({
      minX: Math.min(merged.minX, bounds.minX),
      minY: Math.min(merged.minY, bounds.minY),
      maxX: Math.max(merged.maxX, bounds.maxX),
      maxY: Math.max(merged.maxY, bounds.maxY),
    }),
    { ...boundsList[0] },
  );
}

export function describeAnnotationPosition(bounds: AnnotationBounds, width: number, height: number) {
  const centerX = ((bounds.minX + bounds.maxX) / 2) / Math.max(width, 1);
  const centerY = ((bounds.minY + bounds.maxY) / 2) / Math.max(height, 1);
  const horizontal = centerX < 0.33 ? '左侧' : centerX > 0.67 ? '右侧' : '中部';
  const vertical = centerY < 0.33 ? '上方' : centerY > 0.67 ? '下方' : '中部';

  if (horizontal === '中部' && vertical === '中部') return '画面中部';
  if (horizontal === '中部') return `画面${vertical}`;
  if (vertical === '中部') return `画面${horizontal}`;
  return `画面${vertical}${horizontal}`;
}

export function buildAnnotationPromptNote(
  label: string,
  regions: AnnotationBounds[],
  width: number,
  height: number,
) {
  const cleanLabel = label.replace(/标注$/, '');
  const firstRegion = regions[0];
  if (!firstRegion) {
    return `【标注说明】图片：${cleanLabel}。请优先处理标注区域，未标注区域尽量保持原图一致。`;
  }
  const describeRegion = (bounds: AnnotationBounds, index?: number) => {
    const position = describeAnnotationPosition(bounds, width, height);
    const widthPercent = Math.max(1, Math.round(((bounds.maxX - bounds.minX) / Math.max(width, 1)) * 100));
    const heightPercent = Math.max(1, Math.round(((bounds.maxY - bounds.minY) / Math.max(height, 1)) * 100));
    const prefix = typeof index === 'number' ? `区域 ${index + 1}：` : '';
    return `${prefix}${position}，覆盖范围约为画面宽度 ${widthPercent}%、高度 ${heightPercent}%`;
  };

  if (regions.length <= 1) {
    return `【标注说明】图片：${cleanLabel}。标注区域：${describeRegion(firstRegion)}。请优先处理这块标注区域，未标注区域尽量保持原图一致。`;
  }

  return `【标注说明】图片：${cleanLabel}。标注区域共 ${regions.length} 处：${regions.map(describeRegion).join('；')}。请分别处理这些标注区域，未标注区域尽量保持原图一致。`;
}

export function appendEditablePromptNote(prompt: string, note: string, previousNote?: string) {
  const normalizedPrompt = previousNote
    ? prompt.replace(previousNote, '').replace(/\n{3,}/g, '\n\n').trimEnd()
    : prompt.trimEnd();
  const trimmed = normalizedPrompt.trimEnd();
  if (!trimmed) {
    return `${note}\n请继续补充希望 AI 如何修改这个区域。`;
  }
  return `${trimmed}\n\n${note}`;
}
