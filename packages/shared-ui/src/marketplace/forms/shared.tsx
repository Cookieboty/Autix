'use client';

import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '../../ui/button';
import { useTranslations } from 'next-intl';
import type { TemplateVariable, RuntimeReq } from '@autix/shared-store';
import { ImageUploader } from '../../template/ImageUploader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { cn } from '../../ui/utils';

export interface CategoryOption {
  value: string;
  label: string;
}

// 统一的输入控件 className（替代旧 inputStyle 内联样式）
export const inputClass =
  'w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function FieldLabel({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span>
        {children}
        {required ? ' *' : ''}
      </span>
      {hint ? (
        <span className="font-normal text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  required,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel required={required} hint={hint}>
        {label}
      </FieldLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, 'h-10')}
      />
    </div>
  );
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  required,
  label,
  hint,
  rows = 4,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  label: string;
  hint?: string;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel required={required} hint={hint}>
        {label}
      </FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(inputClass, 'resize-y py-2', mono && 'font-mono')}
      />
    </div>
  );
}

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  required,
  label,
  hint,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  required?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel required={required} hint={hint}>
        {label}
      </FieldLabel>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  placeholder,
  required,
  label,
  hint,
  min,
  max,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  required?: boolean;
  label: string;
  hint?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel required={required} hint={hint}>
        {label}
      </FieldLabel>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
        placeholder={placeholder}
        min={min}
        max={max}
        className={cn(inputClass, 'h-10')}
      />
    </div>
  );
}

export function CategoryPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: CategoryOption[];
}) {
  const t = useTranslations('publish');
  return (
    <div className="space-y-1">
      <FieldLabel required>{t('fieldCategory')}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={cn(
              'cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              value === c.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TagsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations('publish');
  return (
    <TextField
      label={t('fieldTags')}
      hint={t('fieldTagsHint')}
      value={value}
      onChange={onChange}
      placeholder={t('fieldTagsPlaceholder')}
    />
  );
}

export function CoverField({
  value,
  onChange,
  folder = 'marketplace',
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  folder?: string;
}) {
  const t = useTranslations('publish');
  return (
    <div className="space-y-1">
      <FieldLabel>{t('fieldCover')}</FieldLabel>
      <ImageUploader value={value} onChange={onChange} folder={folder} />
    </div>
  );
}

export function ExampleMediaField({
  values,
  onChange,
  folder = 'marketplace',
  label,
}: {
  values: (string | undefined)[];
  onChange: (vs: (string | undefined)[]) => void;
  folder?: string;
  label?: string;
}) {
  const t = useTranslations('publish');
  const resolvedLabel = label ?? t('fieldExampleImages');
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <FieldLabel>{resolvedLabel}</FieldLabel>
        <Button
          size="sm"
          variant="ghost"
          className="cursor-pointer"
          onClick={() => onChange([...values, undefined])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> {t('fieldExampleAdd')}
        </Button>
      </div>
      {values.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {values.map((v, i) => (
            <ImageUploader
              key={i}
              value={v}
              folder={folder}
              onChange={(url) => {
                const copy = [...values];
                copy[i] = url;
                onChange(copy);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PointsCostField({
  value,
  onChange,
  hint,
}: {
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  const t = useTranslations('publish');
  return (
    <div className="space-y-1">
      <FieldLabel hint={hint ?? t('fieldPointsHintFree')}>
        {t('fieldPointsCost')}
      </FieldLabel>
      <input
        type="number"
        min={0}
        max={10000}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={cn(inputClass, 'h-10')}
      />
    </div>
  );
}

export function VariablesEditor({
  variables,
  onChange,
  description,
}: {
  variables: TemplateVariable[];
  onChange: (vs: TemplateVariable[]) => void;
  description?: string;
}) {
  const t = useTranslations('publish');
  const update = (i: number, field: keyof TemplateVariable, v: string) => {
    const copy = [...variables];
    copy[i] = { ...copy[i], [field]: v };
    onChange(copy);
  };
  return (
    <div className="space-y-2">
      {description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {variables.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={v.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder={t('varKeyPlaceholder')}
            className={cn(inputClass, 'h-8 flex-1 px-2 font-mono text-xs')}
          />
          <input
            value={v.label}
            onChange={(e) => update(i, 'label', e.target.value)}
            placeholder={t('varLabelPlaceholder')}
            className={cn(inputClass, 'h-8 flex-1 px-2 text-xs')}
          />
          <Select value={v.type} onValueChange={(val) => update(i, 'type', val)}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">{t('varTypeText')}</SelectItem>
              <SelectItem value="select">{t('varTypeSelect')}</SelectItem>
              <SelectItem value="number">{t('varTypeNumber')}</SelectItem>
            </SelectContent>
          </Select>
          <input
            value={v.default ?? ''}
            onChange={(e) => update(i, 'default', e.target.value)}
            placeholder={t('varDefaultPlaceholder')}
            className={cn(inputClass, 'h-8 flex-1 px-2 text-xs')}
          />
          <button
            type="button"
            className="cursor-pointer p-1"
            onClick={() => onChange(variables.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="cursor-pointer"
        onClick={() =>
          onChange([...variables, { key: '', label: '', type: 'text' }])
        }
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> {t('varAdd')}
      </Button>
    </div>
  );
}

export function RuntimeOverrideField({
  value,
  onChange,
  detectionHint,
  fixedReason,
}: {
  value: RuntimeReq | undefined;
  onChange: (v: RuntimeReq | undefined) => void;
  detectionHint?: string;
  fixedReason?: string;
}) {
  const t = useTranslations('publish');
  const labels: Record<RuntimeReq | 'AUTO', string> = {
    AUTO: t('fieldRuntimeAuto'),
    CLOUD: t('fieldRuntimeCloud'),
    DESKTOP_ONLY: t('fieldRuntimeDesktop'),
    EITHER: t('fieldRuntimeEither'),
  };
  if (fixedReason) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{fixedReason}</span>
      </div>
    );
  }
  const internal = value ?? 'AUTO';
  return (
    <div className="space-y-1">
      <FieldLabel hint={t('fieldRuntimeHint')}>{t('fieldRuntime')}</FieldLabel>
      <Select
        value={internal}
        onValueChange={(val) => {
          const v = val as RuntimeReq | 'AUTO';
          onChange(v === 'AUTO' ? undefined : v);
        }}
      >
        <SelectTrigger className="h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(['AUTO', 'CLOUD', 'DESKTOP_ONLY', 'EITHER'] as const).map((k) => (
            <SelectItem key={k} value={k}>
              {labels[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {detectionHint ? (
        <p className="text-xs text-muted-foreground">
          {t('fieldRuntimeDetectionPrefix')}
          {detectionHint}
        </p>
      ) : null}
    </div>
  );
}

// Shared form-state shape for fields common to all 5 resource types
export interface CommonFormState {
  title: string;
  description: string;
  category: string;
  coverImage: string | undefined;
  tags: string;
  pointsCost: number;
  runtimeOverride: RuntimeReq | undefined;
}

export const initialCommonState = (defaultCategory: string): CommonFormState => ({
  title: '',
  description: '',
  category: defaultCategory,
  coverImage: undefined,
  tags: '',
  pointsCost: 0,
  runtimeOverride: undefined,
});

export function buildCommonPayload(s: CommonFormState) {
  return {
    title: s.title.trim(),
    description: s.description.trim() || undefined,
    category: s.category,
    coverImage: s.coverImage,
    tags: s.tags.split(',').map((t) => t.trim()).filter(Boolean),
    pointsCost: s.pointsCost,
    runtimeRequirement: s.runtimeOverride,
  };
}
