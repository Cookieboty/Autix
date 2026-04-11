'use client';

import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

interface DropdownState {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const DropdownStateCtx = createContext<DropdownState>({ open: false, setOpen: () => {} });

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMousedown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMousedown);
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('mousedown', onMousedown);
      document.removeEventListener('keydown', onKeydown);
    };
  }, [open]);

  return (
    <DropdownStateCtx.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative inline-block">
        {children}
      </div>
    </DropdownStateCtx.Provider>
  );
}

// Alias for compatibility
const DropdownMenuGroup = DropdownMenu;

function DropdownMenuTrigger({ children, asChild, className, ...props }: { children: React.ReactNode; asChild?: boolean; className?: string; [key: string]: any }) {
  const { open, setOpen } = useContext(DropdownStateCtx);
  return (
    <div onClick={() => setOpen(!open)} className={cn('cursor-pointer', className)} {...props}>
      {children}
    </div>
  );
}

interface DropdownMenuContentProps {
  className?: string;
  children: React.ReactNode;
  align?: 'start' | 'end' | 'center';
  sideOffset?: number;
}

function DropdownMenuContent({ className, children, align = 'end' }: DropdownMenuContentProps) {
  const { open } = useContext(DropdownStateCtx);
  if (!open) return null;

  const alignClass =
    align === 'end' ? 'right-0' :
    align === 'start' ? 'left-0' :
    'left-1/2 -translate-x-1/2';

  return (
    <div
      className={cn(
        'absolute top-full mt-1 z-50 min-w-[160px]',
        'bg-background border border-border rounded-xl shadow-lg py-1',
        alignClass,
        className
      )}
    >
      {children}
    </div>
  );
}

function DropdownMenuItem({ className, children, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { setOpen } = useContext(DropdownStateCtx);
  return (
    <div
      className={cn(
        'flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-muted/60 transition-colors',
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('border-t border-border my-1', className)} />;
}

function DropdownMenuLabel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-3 py-1.5 text-xs font-medium text-muted-foreground', className)} {...props}>
      {children}
    </div>
  );
}

function DropdownMenuSection({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('py-1', className)}>{children}</div>;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSection,
};
