import * as React from 'react';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'accent';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function variantStyle(variant: BadgeVariant): React.CSSProperties {
  switch (variant) {
    case 'default':
      return {
        backgroundColor: 'var(--panel-muted)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
      };
    case 'secondary':
      return {
        backgroundColor:
          'color-mix(in srgb, var(--panel-muted) 72%, var(--panel))',
        color: 'var(--muted)',
        border: '1px solid var(--border)',
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        color: 'var(--foreground)',
        border: '1px solid var(--border-strong)',
      };
    case 'accent':
      return {
        backgroundColor: 'var(--accent-soft)',
        color: 'var(--accent)',
        border:
          '1px solid color-mix(in srgb, var(--accent) 20%, var(--border))',
      };
  }
}

export function Badge({
  className = '',
  variant = 'default',
  style,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}
      style={{ ...variantStyle(variant), ...style }}
      {...props}
    />
  );
}
