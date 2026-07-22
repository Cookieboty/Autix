'use client';

import * as React from 'react';

/** `next/image` 的极简兼容层：丢弃 Next 专属 props，用原生 `<img>` 渲染。 */
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
  loading,
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
  return (
    <img
      {...rest}
      loading={loading ?? (priority ? 'eager' : 'lazy')}
      decoding={rest.decoding ?? 'async'}
      fetchPriority={priority ? 'high' : undefined}
      style={finalStyle}
    />
  );
};

export default Image;
