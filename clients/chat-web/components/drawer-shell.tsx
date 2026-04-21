'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const drawerWidthClass = {
  sm: 'w-[420px] max-w-[92vw]',
  md: 'w-[520px] max-w-[92vw]',
  lg: 'w-[640px] max-w-[92vw]',
  xl: 'w-[760px] max-w-[92vw]',
} as const;

type DrawerWidth = keyof typeof drawerWidthClass;
type DrawerSide = 'left' | 'right';

interface DrawerShellProps {
  open: boolean;
  onClose: () => void;
  width?: DrawerWidth;
  side?: DrawerSide;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function DrawerShell({
  open,
  onClose,
  width = 'md',
  side = 'right',
  header,
  footer,
  children,
}: DrawerShellProps) {
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

  const isRight = side === 'right';
  const sideClass = isRight ? 'right-0' : 'left-0';
  const borderClass = isRight ? 'border-l' : 'border-r';
  const closedTransform = isRight ? 'translateX(100%)' : 'translateX(-100%)';

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        onClick={onClose}
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundColor: 'var(--backdrop)',
          backdropFilter: 'blur(4px)',
          opacity: visible ? 1 : 0,
          transition: `opacity var(--motion-base) var(--ease-out)`,
        }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 ${sideClass} ${borderClass} flex h-full flex-col overflow-hidden ${drawerWidthClass[width]}`}
        style={{
          backgroundColor: 'var(--panel)',
          borderColor: 'var(--border)',
          transform: visible ? 'translateX(0)' : closedTransform,
          transition: `transform var(--motion-slow) var(--ease-out)`,
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

interface DrawerHeroProps {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
}

export function DrawerHero({
  icon,
  eyebrow,
  title,
  description,
  meta,
}: DrawerHeroProps) {
  return (
    <div className="flex w-full items-start gap-3">
      {icon ? (
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: 'var(--panel-muted)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          }}
        >
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow ? (
          <p
            className="text-[10.5px] font-medium uppercase tracking-[0.18em]"
            style={{ color: 'var(--muted)' }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          className="truncate text-[15px] font-semibold leading-6 tracking-[-0.01em]"
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

interface DrawerBodyProps {
  children: ReactNode;
  className?: string;
}

export function DrawerBody({ children, className = '' }: DrawerBodyProps) {
  return (
    <div className={`space-y-6 px-6 py-6 ${className}`}>{children}</div>
  );
}

interface DrawerSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export function DrawerSection({
  title,
  description,
  children,
}: DrawerSectionProps) {
  return (
    <section className="space-y-3">
      {title || description ? (
        <div className="space-y-1">
          {title ? (
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              {title}
            </h3>
          ) : null}
          {description ? (
            <p
              className="text-xs leading-5"
              style={{ color: 'var(--muted)' }}
            >
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

interface DrawerFooterRowProps {
  aside?: ReactNode;
  actions: ReactNode;
}

export function DrawerFooterRow({ aside, actions }: DrawerFooterRowProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div
        className="min-w-0 flex-1 text-xs leading-5"
        style={{ color: 'var(--muted)' }}
      >
        {aside}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

type DrawerTagTone = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const drawerTagTone: Record<DrawerTagTone, React.CSSProperties> = {
  default: {
    color: 'var(--muted)',
    backgroundColor: 'var(--panel-muted)',
    border: '1px solid var(--border)',
  },
  accent: {
    color: 'var(--accent)',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--accent)',
  },
  success: {
    color: 'var(--success)',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--success)',
  },
  warning: {
    color: 'var(--warning)',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--warning)',
  },
  danger: {
    color: 'var(--danger)',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--danger)',
  },
};

interface DrawerTagProps {
  children: ReactNode;
  tone?: DrawerTagTone;
}

export function DrawerTag({ children, tone = 'default' }: DrawerTagProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em]"
      style={drawerTagTone[tone]}
    >
      {children}
    </span>
  );
}

interface DrawerErrorProps {
  children: ReactNode;
}

export function DrawerError({ children }: DrawerErrorProps) {
  return (
    <div
      className="flex items-start gap-2 rounded-md px-3 py-2.5 text-sm leading-5"
      style={{
        color: 'var(--danger)',
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--danger)',
      }}
    >
      {children}
    </div>
  );
}
