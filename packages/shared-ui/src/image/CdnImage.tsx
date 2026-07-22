'use client';

import * as React from 'react';
import { buildImagePlaceholder, buildImageSrcSet, buildImageUrl } from './url';

/** 走 Cloudflare Image Resizing 的图片组件。使用点无需手写 `/cdn-cgi/image/` 前缀。 */
export interface CdnImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'placeholder'> {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  widths?: number[];
  quality?: number;
  fit?: 'cover' | 'contain' | 'scale-down' | 'crop' | 'pad';
  sizes?: string;
  /** 首屏关键图；true 时 loading=eager + fetchpriority=high。 */
  priority?: boolean;
  aspectRatio?: string | number;
  /** 生成 LQIP 占位并作为 background-image。 */
  blurPlaceholder?: boolean;
}

export const CdnImage = React.forwardRef<HTMLImageElement, CdnImageProps>(function CdnImage(
  {
    src,
    alt,
    width,
    height,
    widths,
    quality = 75,
    fit = 'cover',
    sizes,
    priority,
    aspectRatio,
    blurPlaceholder,
    loading,
    decoding,
    style,
    ...rest
  },
  ref,
) {
  if (!src) return null;

  const finalSrc = buildImageUrl(src, {
    width: width ?? (widths ? Math.max(...widths) : undefined),
    height,
    quality,
    fit,
  });
  const srcSet = widths && widths.length > 0
    ? buildImageSrcSet(src, widths, { quality, fit })
    : undefined;
  const placeholderUrl = blurPlaceholder ? buildImagePlaceholder(src) : undefined;

  const finalStyle: React.CSSProperties = {
    ...(aspectRatio != null ? { aspectRatio: String(aspectRatio) } : null),
    ...(placeholderUrl
      ? {
          backgroundImage: `url("${placeholderUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : null),
    ...style,
  };

  return (
    <img
      ref={ref}
      {...rest}
      src={finalSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={loading ?? (priority ? 'eager' : 'lazy')}
      decoding={decoding ?? 'async'}
      fetchPriority={priority ? 'high' : undefined}
      style={finalStyle}
    />
  );
});
