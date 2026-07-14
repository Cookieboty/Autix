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

export interface SizeGridControlProps {
  label: string;
  value: string;
  /** 来自 property.enum + x-ui.optionLabels（字面量 label，如 '1:1' / '2K'）。 */
  options: Array<{ value: string; label: string }>;
  /** x-ui.groupBy，如 'tier'。仅 'tier' 触发分辨率档位分组，其它值退化成单组平铺。 */
  groupBy?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}
