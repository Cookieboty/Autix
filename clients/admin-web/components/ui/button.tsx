'use client';

import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'warning' | 'link' | 'default' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'xs' | 'icon' | 'default';
}

const variantClasses: Record<string, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-border bg-transparent text-foreground hover:bg-muted/60',
  ghost: 'bg-transparent text-foreground hover:bg-muted/60',
  danger: 'bg-danger text-danger-foreground hover:bg-danger/90',
  destructive: 'bg-danger text-danger-foreground hover:bg-danger/90',
  warning: 'bg-warning text-warning-foreground hover:bg-warning/90',
  link: 'bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto',
};

const sizeClasses: Record<string, string> = {
  xs: 'h-7 px-2 text-xs rounded-md',
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-9 px-4 text-sm rounded-xl',
  default: 'h-9 px-4 text-sm rounded-xl',
  lg: 'h-10 px-6 text-base rounded-xl',
  icon: 'h-9 w-9 rounded-xl',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant] ?? variantClasses.primary,
        sizeClasses[size] ?? sizeClasses.md,
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export const buttonVariants = (opts?: { variant?: string; size?: string }) => {
  const v = opts?.variant ?? 'primary';
  const s = opts?.size ?? 'md';
  return cn(
    'inline-flex items-center justify-center font-medium transition-colors cursor-pointer',
    variantClasses[v] ?? variantClasses.primary,
    sizeClasses[s] ?? sizeClasses.md
  );
};
