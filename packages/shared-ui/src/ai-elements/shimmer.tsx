import { memo, type HTMLAttributes } from 'react';
import { cn } from '../ui/utils';

export type ShimmerProps = HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
};

const ShimmerComponent = ({ children, className, ...props }: ShimmerProps) => (
  <span
    className={cn(
      'relative inline-block animate-pulse text-muted-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

export const Shimmer = memo(ShimmerComponent);
Shimmer.displayName = 'Shimmer';
