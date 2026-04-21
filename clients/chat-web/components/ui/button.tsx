import * as React from 'react';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
};

function variantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'default':
      return {
        backgroundColor: 'var(--accent)',
        color: 'var(--accent-foreground)',
        border: '1px solid transparent',
      };
    case 'outline':
      return {
        backgroundColor: 'var(--panel)',
        color: 'var(--foreground)',
        border: '1px solid var(--border-strong)',
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        color: 'var(--foreground)',
        border: '1px solid transparent',
      };
    case 'secondary':
      return {
        backgroundColor: 'var(--panel-muted)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
      };
    case 'danger':
      return {
        backgroundColor: 'var(--danger)',
        color: 'var(--danger-foreground)',
        border: '1px solid transparent',
      };
  }
}

function hoverStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'default':
      return { backgroundColor: 'var(--accent-hover)' };
    case 'outline':
      return { backgroundColor: 'var(--panel-hover)' };
    case 'ghost':
      return { backgroundColor: 'var(--panel-hover)' };
    case 'secondary':
      return { backgroundColor: 'var(--panel-hover)' };
    case 'danger':
      return {
        backgroundColor:
          'color-mix(in srgb, var(--danger) 88%, var(--foreground) 12%)',
      };
  }
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className = '', variant = 'default', size = 'md', style, children, disabled, ...props },
    ref,
  ) => {
    const base = variantStyle(variant);
    const hover = hoverStyle(variant);

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-medium ${sizeClass[size]} ${className}`}
        style={{
          ...base,
          boxShadow: 'var(--shadow-soft)',
          opacity: disabled ? 'var(--disabled-opacity, 0.55)' : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...style,
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          Object.assign(e.currentTarget.style, hover);
        }}
        onMouseLeave={(e) => {
          if (disabled) return;
          Object.assign(e.currentTarget.style, {
            backgroundColor: base.backgroundColor,
          });
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
