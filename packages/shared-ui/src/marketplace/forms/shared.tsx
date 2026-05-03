'use client';

import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';
import type { TemplateVariable, RuntimeReq } from '@autix/shared-lib';
import { ImageUploader } from '../../template/ImageUploader';

export interface CategoryOption {
  value: string;
  label: string;
}

export const inputStyle: React.CSSProperties = {
  border: '1px solid var(--input-border)',
  backgroundColor: 'var(--input-bg)',
  color: 'var(--foreground)',
};

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
    <label
      className="text-xs font-medium flex items-center gap-1.5"
      style={{ color: 'var(--foreground)' }}
    >
      <span>
        {children}
        {required ? ' *' : ''}
      </span>
      {hint ? (
        <span className="font-normal" style={{ color: 'var(--muted)' }}>
          {hint}
        </span>
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
        className="w-full h-10 px-3 text-sm rounded-md outline-none"
        style={inputStyle}
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
        className={`w-full px-3 py-2 text-sm rounded-md outline-none resize-y ${mono ? 'font-mono' : ''}`}
        style={inputStyle}
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full h-10 px-3 text-sm rounded-md outline-none"
        style={inputStyle}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
        className="w-full h-10 px-3 text-sm rounded-md outline-none"
        style={inputStyle}
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
      <div className="flex gap-2 flex-wrap">
        {options.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor:
                value === c.value ? 'var(--accent)' : 'var(--panel-muted)',
              color: value === c.value ? '#fff' : 'var(--muted)',
            }}
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
          onPress={() => onChange([...values, undefined])}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> {t('fieldExampleAdd')}
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
        className="w-full h-10 px-3 text-sm rounded-md outline-none"
        style={inputStyle}
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
        <p className="text-xs leading-5" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      ) : null}
      {variables.map((v, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={v.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder={t('varKeyPlaceholder')}
            className="flex-1 h-8 px-2 text-xs rounded-md outline-none font-mono"
            style={inputStyle}
          />
          <input
            value={v.label}
            onChange={(e) => update(i, 'label', e.target.value)}
            placeholder={t('varLabelPlaceholder')}
            className="flex-1 h-8 px-2 text-xs rounded-md outline-none"
            style={inputStyle}
          />
          <select
            value={v.type}
            onChange={(e) => update(i, 'type', e.target.value)}
            className="w-24 h-8 px-2 text-xs rounded-md outline-none"
            style={inputStyle}
          >
            <option value="text">{t('varTypeText')}</option>
            <option value="select">{t('varTypeSelect')}</option>
            <option value="number">{t('varTypeNumber')}</option>
          </select>
          <input
            value={v.default ?? ''}
            onChange={(e) => update(i, 'default', e.target.value)}
            placeholder={t('varDefaultPlaceholder')}
            className="flex-1 h-8 px-2 text-xs rounded-md outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            className="p-1 cursor-pointer"
            onClick={() => onChange(variables.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          </button>
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="cursor-pointer"
        onPress={() =>
          onChange([...variables, { key: '', label: '', type: 'text' }])
        }
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> {t('varAdd')}
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
      <div
        className="rounded-md px-3 py-2 text-xs flex items-start gap-2"
        style={{
          border: '1px solid var(--border)',
          backgroundColor: 'var(--panel-muted)',
          color: 'var(--muted)',
        }}
      >
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>{fixedReason}</span>
      </div>
    );
  }
  const internal = value ?? 'AUTO';
  return (
    <div className="space-y-1">
      <FieldLabel hint={t('fieldRuntimeHint')}>{t('fieldRuntime')}</FieldLabel>
      <select
        value={internal}
        onChange={(e) => {
          const v = e.target.value as RuntimeReq | 'AUTO';
          onChange(v === 'AUTO' ? undefined : v);
        }}
        className="w-full h-10 px-3 text-sm rounded-md outline-none"
        style={inputStyle}
      >
        {(['AUTO', 'CLOUD', 'DESKTOP_ONLY', 'EITHER'] as const).map((k) => (
          <option key={k} value={k}>
            {labels[k]}
          </option>
        ))}
      </select>
      {detectionHint ? (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
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
