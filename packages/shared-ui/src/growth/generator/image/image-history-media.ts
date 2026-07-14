/**
 * 历史图片的「导出 / 展示」两个跨组件复用点：列表面板（多选批量下载）与详情弹窗
 * （单图下载、创建时间）都要用。放在这里而不是任一组件里，是为了避免详情弹窗
 * 反向 import 列表面板（后者已经 import 前者，会成环）。
 */

/** 客户端下载图片：优先 fetch→blob；跨域拿不到 blob 时回退新窗口打开。 */
export async function downloadImageFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  }
}

/**
 * 复制图片本体到剪贴板。
 *
 * 浏览器只保证 image/png 能进剪贴板 —— 厂商回的 webp/jpeg 直接 write 会被拒，
 * 所以非 png 一律先过一遍 canvas 转码。失败返回 false，由调用方 toast（不静默吞）。
 */
export async function copyImageToClipboard(url: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const png = blob.type === 'image/png' ? blob : await transcodeToPng(blob);
    if (!png) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
}

/** 复制任意文本（图片 URL）。 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function transcodeToPng(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
        return;
      }
      ctx.drawImage(image, 0, 0);
      canvas.toBlob((png) => {
        URL.revokeObjectURL(objectUrl);
        resolve(png);
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = objectUrl;
  });
}

/** 生成时间的展示值；非法时间返回空串（调用方决定占位符）。 */
export function formatGenerationTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
