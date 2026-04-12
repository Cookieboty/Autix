'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open, onOpenChange, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange?.(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <SheetContext open={open} onOpenChange={onOpenChange}>
      {children}
    </SheetContext>,
    document.body
  );
}

function SheetContext({ open, onOpenChange, children }: SheetProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      {children}
    </>
  );
}

function SheetTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

interface SheetContentProps {
  className?: string;
  children: React.ReactNode;
  side?: 'left' | 'right' | 'top' | 'bottom';
}

function SheetContent({ className, children, side = 'right' }: SheetContentProps) {
  const sideClasses = {
    right: 'right-0 top-0 h-full translate-x-0',
    left: 'left-0 top-0 h-full translate-x-0',
    top: 'top-0 left-0 w-full translate-y-0',
    bottom: 'bottom-0 left-0 w-full translate-y-0',
  };

  return (
    <div
      className={cn(
        'fixed z-50 bg-background shadow-2xl border-l border-border flex flex-col',
        sideClasses[side],
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function SheetHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5', className)} {...props}>
      {children}
    </div>
  );
}

function SheetBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex-1 overflow-y-auto', className)} {...props}>
      {children}
    </div>
  );
}

function SheetFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-end gap-2', className)} {...props}>
      {children}
    </div>
  );
}

function SheetTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-lg font-semibold text-foreground', className)} {...props}>
      {children}
    </h2>
  );
}

function SheetDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
