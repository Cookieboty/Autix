'use client';

import type { ComponentProps, ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../ui';
import { cn } from '../ui/utils';

type AuthFieldShellProps = {
  id?: string;
  errorId?: string;
  label: ReactNode;
  error?: ReactNode;
  children: ReactNode;
};

export function AuthFieldShell({ id, errorId, label, error, children }: AuthFieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-foreground/80 block"
      >
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} className="text-xs mt-1 text-destructive">{error}</p>
      )}
    </div>
  );
}

type AuthInputFieldProps = Omit<ComponentProps<typeof Input>, 'id'> & {
  id: string;
  label: string;
  error?: ReactNode;
  registration?: UseFormRegisterReturn;
};

export function AuthInputField({
  id,
  label,
  error,
  registration,
  className,
  type = 'text',
  ...props
}: AuthInputFieldProps) {
  return (
    <AuthFieldShell id={id} label={label} error={error}>
      <Input
        id={id}
        type={type}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        className={cn('w-full', className)}
        {...registration}
        {...props}
      />
    </AuthFieldShell>
  );
}

type AuthPasswordFieldProps = Omit<ComponentProps<typeof Input>, 'id' | 'type'> & {
  id: string;
  label: string;
  error?: ReactNode;
  registration?: UseFormRegisterReturn;
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
};

export function AuthPasswordField({
  id,
  label,
  error,
  registration,
  visible,
  onToggle,
  showLabel,
  hideLabel,
  className,
  ...props
}: AuthPasswordFieldProps) {
  return (
    <AuthFieldShell id={id} label={label} error={error}>
      <div className="relative">
        <Input
          id={id}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          type={visible ? 'text' : 'password'}
          className={cn('w-full pr-10', className)}
          {...registration}
          {...props}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer text-muted-foreground hover:text-foreground"
          aria-label={visible ? hideLabel : showLabel}
          onClick={onToggle}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </AuthFieldShell>
  );
}

type AuthAlertProps = {
  children: ReactNode;
  icon?: ReactNode;
};

export function AuthErrorAlert({ children, icon }: AuthAlertProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20',
        icon && 'flex items-start gap-2',
      )}
      role="alert"
    >
      {icon}
      {children}
    </div>
  );
}

export function AuthInfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl p-4 text-sm text-foreground bg-secondary border border-border">
      {children}
    </div>
  );
}
