'use client';

import { cn } from '@/lib/utils';

type BadgeVariant = 'solid' | 'outline' | 'flat' | 'secondary' | 'default' | 'success' | 'danger' | 'warning';

function Badge({
  className,
  variant = 'outline',
  color,
  children,
  ...props
}: React.ComponentProps<'span'> & {
  variant?: BadgeVariant;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default';
}) {
  const variantClasses: Record<string, string> = {
    solid: 'bg-accent text-accent-foreground border-transparent',
    outline: 'border border-border bg-transparent text-foreground',
    flat: 'bg-surface-secondary text-foreground border-transparent',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    default: 'bg-surface-secondary text-muted-foreground border-transparent',
    success: 'bg-success/15 text-success border-success/20',
    danger: 'bg-danger/15 text-danger border-danger/20',
    warning: 'bg-warning/15 text-warning border-warning/20',
  };

  const colorClasses: Record<string, string> = {
    primary: 'bg-accent text-accent-foreground border-transparent',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    success: 'bg-success/15 text-success border-success/20',
    warning: 'bg-warning/15 text-warning border-warning/20',
    danger: 'bg-danger/15 text-danger border-danger/20',
    default: 'bg-surface-secondary text-muted-foreground border-transparent',
  };

  const baseClass = color ? colorClasses[color] : (variantClasses[variant] ?? variantClasses.outline);

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border',
        baseClass,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
