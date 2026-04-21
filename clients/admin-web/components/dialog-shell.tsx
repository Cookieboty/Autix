'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const dialogWidthClass = {
  sm: 'max-w-[420px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[640px]',
  xl: 'max-w-[780px]',
} as const;

type DialogWidth = keyof typeof dialogWidthClass;

interface AdminDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: DialogWidth;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  dismissable?: boolean;
}

export function AdminDialogShell({
  open,
  onOpenChange,
  width = 'md',
  header,
  footer,
  children,
  dismissable = true,
}: AdminDialogShellProps) {
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
      if (e.key === 'Escape' && dismissable) onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange, dismissable]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10 sm:px-8"
      role="dialog"
      aria-modal="true"
    >
      <div
        aria-hidden
        onClick={dismissable ? () => onOpenChange(false) : undefined}
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
          transform: visible
            ? 'translateY(0) scale(1)'
            : 'translateY(8px) scale(0.98)',
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
          {dismissable ? (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
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
          ) : null}
        </header>

        <div
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6"
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

interface AdminDialogHeroProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  meta?: ReactNode;
}

const heroToneMap = {
  default: {
    backgroundColor: 'var(--panel-muted)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  },
  accent: {
    backgroundColor: 'var(--panel-muted)',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
  },
  success: {
    backgroundColor: 'var(--panel-muted)',
    border: '1px solid var(--success)',
    color: 'var(--success)',
  },
  warning: {
    backgroundColor: 'var(--panel-muted)',
    border: '1px solid var(--warning)',
    color: 'var(--warning)',
  },
  danger: {
    backgroundColor: 'var(--panel-muted)',
    border: '1px solid var(--danger)',
    color: 'var(--danger)',
  },
} as const;

export function AdminDialogHero({
  icon,
  title,
  description,
  tone = 'default',
  meta,
}: AdminDialogHeroProps) {
  return (
    <div className="flex w-full items-start gap-3">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
        style={heroToneMap[tone]}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h2
          className="text-[15px] font-semibold leading-6 tracking-[-0.01em]"
          style={{ color: 'var(--foreground)' }}
        >
          {title}
        </h2>
        {description ? (
          <div className="text-sm leading-5" style={{ color: 'var(--muted)' }}>
            {description}
          </div>
        ) : null}
      </div>
      {meta ? (
        <div className="flex flex-shrink-0 items-center gap-2 pt-0.5">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

interface AdminDialogFooterRowProps {
  aside?: ReactNode;
  actions: ReactNode;
}

export function AdminDialogFooterRow({
  aside,
  actions,
}: AdminDialogFooterRowProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div
        className="min-w-0 flex-1 text-xs leading-5"
        style={{ color: 'var(--muted)' }}
      >
        {aside}
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">{actions}</div>
    </div>
  );
}

export {
  AdminDrawerSection as AdminDialogSection,
  AdminDrawerMeta as AdminDialogMeta,
  AdminDrawerError as AdminDialogError,
} from './drawer-shell';
