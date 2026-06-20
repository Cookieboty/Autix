'use client';

import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type ImeTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  onCommit?: (value: string) => void;
};

export function ImeSafeTextarea({ value, onValueChange, onCommit, onBlur, ...rest }: ImeTextareaProps) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  useEffect(() => {
    if (!composingRef.current) setDraft(value);
  }, [value]);
  return (
    <textarea
      {...rest}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (!composingRef.current) onValueChange(next);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        const next = (event.target as HTMLTextAreaElement).value;
        setDraft(next);
        onValueChange(next);
      }}
      onBlur={(event) => {
        onCommit?.(event.target.value);
        onBlur?.(event);
      }}
    />
  );
}

type ImeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function ImeSafeInput({ value, onValueChange, ...rest }: ImeInputProps) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  useEffect(() => {
    if (!composingRef.current) setDraft(value);
  }, [value]);
  return (
    <input
      {...rest}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (!composingRef.current) onValueChange(next);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        const next = (event.target as HTMLInputElement).value;
        setDraft(next);
        onValueChange(next);
      }}
    />
  );
}
