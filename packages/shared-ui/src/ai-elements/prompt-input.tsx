'use client';

import {
  Children,
  type ComponentProps,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode,
  forwardRef,
  useState,
} from 'react';
import { CornerDownLeftIcon, Loader2Icon, SquareIcon, XIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';

export type PromptInputMessage = {
  text: string;
};

export type PromptInputStatus = 'submitted' | 'streaming' | 'ready' | 'error';

export type PromptInputProps = Omit<HTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  onSubmit?: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void;
};

export const PromptInput = ({
  className,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = (formData.get('message') as string) || '';
    onSubmit?.({ text }, event);
  };

  return (
    <form
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-2xl border border-input bg-background shadow-xs transition-[color,box-shadow] duration-150',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        className,
      )}
      onSubmit={handleSubmit}
      {...props}
    >
      {children}
    </form>
  );
};

export type PromptInputHeaderProps = HTMLAttributes<HTMLDivElement>;
export const PromptInputHeader = ({ className, ...props }: PromptInputHeaderProps) => (
  <div className={cn('flex flex-wrap gap-1', className)} {...props} />
);

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;
export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <div className={cn('contents', className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;
export const PromptInputTextarea = forwardRef<HTMLTextAreaElement, PromptInputTextareaProps>(
  ({ className, placeholder = 'What would you like to know?', onKeyDown, ...props }, ref) => {
    const [isComposing, setIsComposing] = useState(false);

    const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key === 'Enter') {
        if (isComposing || e.nativeEvent.isComposing) return;
        if (e.shiftKey) return;
        e.preventDefault();
        const form = e.currentTarget.form;
        const submitButton = form?.querySelector(
          'button[type="submit"]',
        ) as HTMLButtonElement | null;
        if (submitButton?.disabled) return;
        form?.requestSubmit();
      }
    };

    return (
      <Textarea
        ref={ref}
        name="message"
        className={cn(
          'field-sizing-content max-h-48 min-h-16 w-full resize-none border-0 bg-transparent shadow-none',
          'px-5 pt-4 pb-2 text-sm leading-6 text-foreground',
          'placeholder:text-muted-foreground',
          'focus-visible:border-0 focus-visible:ring-0',
          'md:text-sm',
          className,
        )}
        onCompositionEnd={() => setIsComposing(false)}
        onCompositionStart={() => setIsComposing(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        {...props}
      />
    );
  },
);
PromptInputTextarea.displayName = 'PromptInputTextarea';

export type PromptInputFooterProps = HTMLAttributes<HTMLDivElement>;
export const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <div
    className={cn('flex items-center justify-between gap-2 px-3 pb-2.5 pt-1', className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;
export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div className={cn('flex items-center gap-1', className)} {...props} />
);

export type PromptInputButtonProps = ComponentProps<typeof Button> & {
  children?: ReactNode;
};
export const PromptInputButton = ({
  variant = 'ghost',
  className,
  size,
  children,
  ...props
}: PromptInputButtonProps) => {
  const newSize = size ?? (Children.count(children) > 1 ? 'sm' : 'icon-sm');
  return (
    <Button
      type="button"
      variant={variant}
      size={newSize}
      className={cn(className)}
      {...props}
    >
      {children}
    </Button>
  );
};

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: PromptInputStatus;
};
export const PromptInputSubmit = ({
  className,
  variant = 'default',
  size = 'icon-sm',
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <CornerDownLeftIcon className="size-4" />;
  if (status === 'submitted') {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === 'streaming') {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === 'error') {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <Button
      aria-label="Submit"
      type="submit"
      variant={variant}
      size={size}
      className={cn('rounded-full', className)}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};
