'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';

const drawerWidthClassName = {
  sm: 'w-[440px] max-w-[92vw]',
  md: 'w-[560px] max-w-[92vw]',
  lg: 'w-[720px] max-w-[92vw]',
  xl: 'w-[880px] max-w-[92vw]',
} as const;

type DrawerWidth = keyof typeof drawerWidthClassName;

interface AdminDrawerShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: DrawerWidth;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function AdminDrawerShell({
  open,
  onOpenChange,
  width = 'md',
  header,
  footer,
  children,
}: AdminDrawerShellProps) {
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
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        aria-hidden
        onClick={() => onOpenChange(false)}
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
        className={`absolute right-0 top-0 flex h-full flex-col overflow-hidden ${drawerWidthClassName[width]}`}
        style={{
          backgroundColor: 'var(--panel)',
          borderLeft: '1px solid var(--border)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--motion-slow) var(--ease-out)',
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

interface AdminDrawerBodyProps {
  children: ReactNode;
  className?: string;
}

export function AdminDrawerBody({
  children,
  className = '',
}: AdminDrawerBodyProps) {
  return (
    <div className={`space-y-7 px-6 py-6 ${className}`}>{children}</div>
  );
}

interface AdminDrawerHeroProps {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
}

export function AdminDrawerHero({
  icon,
  eyebrow,
  title,
  description,
  meta,
}: AdminDrawerHeroProps) {
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

interface AdminDrawerSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export function AdminDrawerSection({
  title,
  description,
  children,
}: AdminDrawerSectionProps) {
  return (
    <section className="space-y-4">
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

interface AdminDrawerFooterProps {
  aside?: ReactNode;
  actions: ReactNode;
}

export function AdminDrawerFooter({
  aside,
  actions,
}: AdminDrawerFooterProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div
        className="min-w-0 flex-1 text-xs leading-5"
        style={{ color: 'var(--muted)' }}
      >
        {aside}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2.5">{actions}</div>
    </div>
  );
}

type AdminMetaTone =
  | 'default'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

const metaStyleMap: Record<AdminMetaTone, CSSProperties> = {
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

interface AdminDrawerMetaProps {
  children: ReactNode;
  tone?: AdminMetaTone;
}

export function AdminDrawerMeta({
  children,
  tone = 'default',
}: AdminDrawerMetaProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em]"
      style={metaStyleMap[tone]}
    >
      {children}
    </span>
  );
}

interface AdminDrawerErrorProps {
  children: ReactNode;
}

export function AdminDrawerError({ children }: AdminDrawerErrorProps) {
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

interface AdminFieldProps {
  label?: ReactNode;
  required?: boolean;
  error?: string;
  help?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function AdminField({
  label,
  required,
  error,
  help,
  htmlFor,
  children,
  className = '',
}: AdminFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1 text-[13px] font-medium"
          style={{ color: 'var(--foreground)' }}
        >
          {label}
          {required ? (
            <span style={{ color: 'var(--danger)' }} aria-hidden>
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: 'var(--danger)' }}
        >
          <AlertCircle className="h-3 w-3" strokeWidth={2.25} />
          {error}
        </p>
      ) : help ? (
        <p
          className="text-[12px] leading-[1.5]"
          style={{ color: 'var(--muted)' }}
        >
          {help}
        </p>
      ) : null}
    </div>
  );
}

interface AdminFieldGroupProps {
  columns?: 2 | 3;
  template?: string;
  children: ReactNode;
  className?: string;
}

export function AdminFieldGroup({
  columns = 2,
  template,
  children,
  className = '',
}: AdminFieldGroupProps) {
  const style = template
    ? { gridTemplateColumns: template }
    : undefined;
  const gridClass = template
    ? 'grid gap-5 sm:items-start'
    : columns === 3
      ? 'grid gap-5 sm:grid-cols-3 sm:items-start'
      : 'grid gap-5 sm:grid-cols-2 sm:items-start';
  return (
    <div className={`${gridClass} ${className}`} style={style}>
      {children}
    </div>
  );
}

export const adminInputClassName =
  'h-9 w-full rounded-md px-3 text-[13px] outline-none transition-colors placeholder:text-[color:var(--muted)] disabled:cursor-not-allowed disabled:opacity-70';

export const adminInputStyle: CSSProperties = {
  backgroundColor: 'var(--input-bg, var(--panel))',
  color: 'var(--foreground)',
  border: '1px solid var(--input-border, var(--border))',
};

export const adminTextareaClassName =
  'w-full resize-none rounded-md px-3 py-2 text-[13px] leading-[1.55] outline-none transition-colors placeholder:text-[color:var(--muted)] disabled:cursor-not-allowed disabled:opacity-70';
