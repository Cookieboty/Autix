'use client';

import * as React from 'react';

import { Image, type ImageProps } from '../next-compat';
import { cn } from '../ui/utils';

export type ThemeLogoVariant = 'auto' | 'light' | 'dark';

export interface ThemeLogoProps
  extends Omit<ImageProps, 'src' | 'width' | 'height'> {
  size?: number;
  variant?: ThemeLogoVariant;
}

export function ThemeLogo({
  alt,
  className,
  size = 32,
  style,
  variant = 'auto',
  ...props
}: ThemeLogoProps) {
  const imageClassName = cn('shrink-0 rounded-md', className);
  const imageStyle = {
    width: size,
    height: size,
    ...style,
  };

  const renderImage = (src: string, displayClassName?: string) => (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn(imageClassName, displayClassName)}
      style={imageStyle}
      {...props}
    />
  );

  if (variant === 'dark') return renderImage('/logo-dark.png');
  if (variant === 'light') return renderImage('/logo-light.png');

  return (
    <>
      {renderImage('/logo-light.png', 'block dark:hidden')}
      {renderImage('/logo-dark.png', 'hidden dark:block')}
    </>
  );
}
