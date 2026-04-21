import * as React from 'react';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type = 'text', style, onFocus, onBlur, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={`h-10 w-full rounded-full px-4 text-sm outline-none placeholder:text-[color:var(--muted)] disabled:cursor-not-allowed ${className}`}
        style={{
          backgroundColor: 'var(--input-bg)',
          color: 'var(--foreground)',
          border: '1px solid var(--input-border)',
          boxShadow: '0 0 0 0 transparent',
          transition:
            'border-color var(--motion-base) var(--ease-out), box-shadow var(--motion-base) var(--ease-out)',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring)';
          onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--input-border)';
          e.currentTarget.style.boxShadow = '0 0 0 0 transparent';
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
