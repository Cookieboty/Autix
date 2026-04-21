import * as React from 'react';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', style, ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
        ...style,
      }}
      {...props}
    />
  );
}
