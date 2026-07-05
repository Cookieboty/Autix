import * as React from 'react';

import { cn } from '../ui/utils';

export interface BrandMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Amux 品牌图标（内联 SVG）。
 * 非橙色线条使用 `currentColor`，跟随 `text-foreground` 自适应主题（暗色→白 / 亮色→黑）；
 * 橙色圆点固定为品牌橙 #D75000，不随主题变化。
 */
export function BrandMark({ size = 32, className, ...props }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      fill="none"
      className={cn('shrink-0 text-foreground', className)}
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        width="45"
        height="250"
        rx="22.5"
        fill="currentColor"
        transform="matrix(0.866025,0.5,-0.5,0.866025,191,81.0359)"
      />
      <rect
        width="45"
        height="197.323959"
        rx="22.5"
        fill="currentColor"
        transform="matrix(0.866025,-0.5,0.5,0.866025,169,103.5)"
      />
      <rect
        width="44.999924"
        height="44.999924"
        rx="22.499962"
        fill="#D75000"
        transform="matrix(-1.07231e-07,-1,1,-1.07231e-07,283.446,310)"
      />
      <rect
        width="44.999924"
        height="91.999168"
        rx="22.499962"
        fill="currentColor"
        transform="matrix(-8.54142e-08,-1,1,-8.54142e-08,206,267)"
      />
    </svg>
  );
}
