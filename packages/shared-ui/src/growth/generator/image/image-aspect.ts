/**
 * 历史区图块 / 生成中占位块的宽高比解析。
 *
 * 比例参数**没有单一键名**：protocol 重构后前端与 paramsSchema 的统一词汇是
 * `aspectRatio`（"9:16"），只有少数模型（如 Seedream 5.0 Pro）的 schema 用
 * size-grid 直接给像素串（"1024x1536"）；`size` 在其余模型上只是厂商侧字段名，
 * 根本不出现在 settings 里。settings 又是透传的 schema 参数 bag ——
 * 所以这里按「像素串优先、比例串兜底」取值，而不是硬编码读 `settings.size`
 * （那样 5 个模型里有 4 个取不到，一律退化成 1:1）。
 */

/** 无法从参数解析出比例时的兜底：正方形。 */
export const FALLBACK_ASPECT_RATIO = 1;

/** 解析 "9:16" / "1024x1536" / "1024×1536@1K" 为 w/h；解析不出返回 undefined。 */
export function parseAspectRatio(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/(\d+)\s*[x:×]\s*(\d+)/i);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!(width > 0) || !(height > 0)) return undefined;
  return width / height;
}

/**
 * 从一次生成的 settings 里解析用户选择的比例。
 *
 * `size` 优先于 `aspectRatio`：前者是精确像素串（size-grid 模型只有它），
 * 后者是纯比例。两者都取不到才退化成 1:1。
 */
export function resolveSettingsAspectRatio(settings: Record<string, unknown> | undefined): number {
  if (!settings) return FALLBACK_ASPECT_RATIO;
  return (
    parseAspectRatio(settings.size) ??
    parseAspectRatio(settings.aspectRatio) ??
    FALLBACK_ASPECT_RATIO
  );
}

/**
 * 详情弹窗「尺寸」一行的展示值。同样不能只读 `size` —— 那样多数模型只会显示 "-"。
 * size-grid 模型直接给像素串；其余模型用「比例 · 档位」（如 "9:16 · 2K"），
 * 档位缺省时只给比例。都取不到才是 "-"（由调用方决定占位符）。
 */
export function formatImageSizeLabel(settings: Record<string, unknown> | undefined): string | undefined {
  if (!settings) return undefined;
  if (typeof settings.size === 'string' && settings.size) return settings.size;
  const aspectRatio = typeof settings.aspectRatio === 'string' ? settings.aspectRatio : undefined;
  if (!aspectRatio) return undefined;
  const resolution = typeof settings.resolution === 'string' ? settings.resolution : undefined;
  return resolution ? `${aspectRatio} · ${resolution}` : aspectRatio;
}

/**
 * 图片**加载完成后**的真实比例：以图片自身的 naturalWidth/naturalHeight 为准。
 *
 * 为什么不信 settings：厂商实际返回的尺寸未必等于请求值（会被夹到支持的档位），
 * 而历史区要展示的是「这张图真实长什么样」。加载前先用 settings 的比例占位，
 * 加载后再校正，避免图片一到位就跳版。naturalWidth 为 0（尚未解码/加载失败）
 * 时返回 undefined，调用方继续沿用 settings 的比例。
 */
export function naturalAspectRatio(image: {
  naturalWidth: number;
  naturalHeight: number;
}): number | undefined {
  const { naturalWidth, naturalHeight } = image;
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return undefined;
  return naturalWidth / naturalHeight;
}
