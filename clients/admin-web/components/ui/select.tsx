'use client';

import { cn } from '@/lib/utils';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  defaultValue?: string;
}

function Select({ children, value, onValueChange, disabled, defaultValue }: SelectProps) {
  // Pass context via render, since SelectContent/SelectItem are decorative wrappers
  return (
    <SelectContext value={value} onValueChange={onValueChange} disabled={disabled} defaultValue={defaultValue}>
      {children}
    </SelectContext>
  );
}

// Internal context to pass value/onChange down
import { createContext, useContext } from 'react';

const SelectCtx = createContext<{
  value?: string;
  onValueChange?: (v: string) => void;
  disabled?: boolean;
}>({});

function SelectContext({ value, onValueChange, disabled, defaultValue, children }: SelectProps) {
  return (
    <SelectCtx.Provider value={{ value, onValueChange, disabled }}>
      {children}
    </SelectCtx.Provider>
  );
}

function SelectTrigger({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Decorative wrapper — actual select is rendered by SelectContent or inline
  return <div className={cn('relative', className)} {...props}>{children}</div>;
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = useContext(SelectCtx);
  return null; // value is displayed by the native select itself
}

function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const ctx = useContext(SelectCtx);
  // Collect SelectItem children and render as native <select>
  return (
    <select
      value={ctx.value ?? ''}
      onChange={(e) => ctx.onValueChange?.(e.target.value)}
      disabled={ctx.disabled}
      className={cn(
        'flex h-10 w-full rounded-field border border-border bg-field-background px-3 py-2 text-sm text-field-foreground',
        'focus:outline-none focus:ring-2 focus:ring-focus focus:border-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors cursor-pointer',
        className
      )}
    >
      {children}
    </select>
  );
}

function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <option value={value} className={cn('bg-background text-foreground', className)}>
      {children}
    </option>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
