'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const dialogWidthClass = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
  xl: 'max-w-[960px]',
} as const;

type DialogWidth = keyof typeof dialogWidthClass;

interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  width?: DialogWidth;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  dismissOnBackdrop?: boolean;
}

export function DialogShell({
  open,
  onClose,
  width = 'md',
  header,
  footer,
  children,
  dismissOnBackdrop = true,
}: DialogShellProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(typeof document !== 'undefined');
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10 sm:px-8"
      role="dialog"
      aria-modal="true"
    >
      <div
        aria-hidden
        onClick={dismissOnBackdrop ? onClose : undefined}
        className="absolute inset-0"
        style={{
          backgroundColor: 'var(--backdrop)',
          backdropFilter: 'blur(4px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity var(--motion-base) var(--ease-out)',
        }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative flex max-h-[min(86vh,860px)] w-full flex-col overflow-hidden rounded-lg ${dialogWidthClass[width]}`}
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-panel)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
          transition: `opacity var(--motion-base) var(--ease-out), transform var(--motion-slow) var(--ease-out)`,
          outline: 'none',
        }}
      >
        <header
          className="flex flex-shrink-0 items-start gap-4 px-6 py-4"
          style={{
            backgroundColor: 'var(--panel)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-md"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--panel-muted)';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--muted)';
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ backgroundColor: 'var(--panel)' }}
        >
          {children}
        </div>

        {footer ? (
          <footer
            className="flex-shrink-0 px-6 py-3.5"
            style={{
              backgroundColor: 'var(--panel)',
              borderTop: '1px solid var(--border)',
            }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export {
  DrawerHero as DialogHero,
  DrawerBody as DialogBody,
  DrawerSection as DialogSection,
  DrawerFooterRow as DialogFooterRow,
  DrawerTag as DialogTag,
  DrawerError as DialogError,
} from './drawer-shell';
