import type { ReactNode } from 'react';

export interface ChoiceControlProps {
  label: string;
  value: string | number;
  options: Array<{ value: string | number; label: string; priceTag?: ReactNode }>;
  onChange: (value: string | number) => void;
  disabled?: boolean;
}

export interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export interface BooleanControlProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export interface TextControlProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}
