'use client';

import * as React from 'react';
import { IMAGE_TIERS, buildTieredImageUrl, buildTieredSrcSet } from './url';

/** 走 CF Image Resizing 的图片组件，固定 3 档，使用点无法引入新变换。 */
export interface CdnImageProps
  extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    'src' | 'srcSet' | 'placeholder' | 'width' | 'height'
  > {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  aspectRatio?: string | number;
  /** 显示宽度 < 640:直接用原图,不走 CF(0 次转换、无 srcSet)。 */
  small?: boolean;
}

export const CdnImage = React.forwardRef<HTMLImageElement, CdnImageProps>(function CdnImage(
  { src, alt, sizes, priority, aspectRatio, small, loading, decoding, style, ...rest },
  ref,
) {
  if (!src) return null;

  const finalSrc = small ? src : buildTieredImageUrl(src, 'pad');
  const srcSet = small ? undefined : buildTieredSrcSet(src) || undefined;

  const finalStyle: React.CSSProperties = {
    ...(aspectRatio != null ? { aspectRatio: String(aspectRatio) } : null),
    ...style,
  };

  return (
    <img
      ref={ref}
      {...rest}
      src={finalSrc}
      srcSet={srcSet}
      sizes={sizes ?? `(max-width: 640px) ${IMAGE_TIERS.mobile}px, (max-width: 1024px) ${IMAGE_TIERS.pad}px, ${IMAGE_TIERS.pc}px`}
      alt={alt}
      loading={loading ?? (priority ? 'eager' : 'lazy')}
      decoding={decoding ?? 'async'}
      fetchPriority={priority ? 'high' : undefined}
      style={finalStyle}
    />
  );
});
