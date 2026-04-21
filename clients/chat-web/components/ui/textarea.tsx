import * as React from 'react';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', style, onFocus, onBlur, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full resize-y rounded-md px-3 py-2 text-[14px] leading-6 outline-none placeholder:text-[color:var(--muted)] ${className}`}
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
          e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring)';
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
Textarea.displayName = 'Textarea';
