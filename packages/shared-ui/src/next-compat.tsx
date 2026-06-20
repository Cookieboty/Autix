'use client';

import * as React from 'react';

/**
 * `next/image` 的极简兼容层 — 把所有 Next 专属 props 丢掉后用原生 <img>。
 * 共享层不依赖 Next.js 的图片优化能力；如果需要懒加载，使用 loading="lazy"。
 */
export interface ImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'placeholder'> {
  fill?: boolean;
  priority?: boolean;
  placeholder?: string;
  blurDataURL?: string;
  unoptimized?: boolean;
  quality?: number;
}

export const Image: React.FC<ImageProps> = ({
  fill,
  priority,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  unoptimized: _unoptimized,
  quality: _quality,
  style,
  ...rest
}) => {
  const finalStyle: React.CSSProperties = fill
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style,
      }
    : style ?? {};

  return <img loading={priority ? 'eager' : 'lazy'} style={finalStyle} {...rest} />;
};

export default Image;
