'use client';

import type { TemplateVariable } from '@/lib/api';

export function VariableEditor({
  variables,
  values,
  onChange,
}: {
  variables: TemplateVariable[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const update = (key: string, val: string) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <div className="space-y-3">
      {variables.map((v) => (
        <div key={v.key} className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
            {v.label}
            <span className="ml-1 font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
              {`{{${v.key}}}`}
            </span>
          </label>
          {v.options && v.options.length > 0 ? (
            <select
              value={values[v.key] ?? v.default ?? ''}
              onChange={(e) => update(v.key, e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-md outline-none"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            >
              {v.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              value={values[v.key] ?? v.default ?? ''}
              onChange={(e) => update(v.key, e.target.value)}
              placeholder={v.default ?? ''}
              className="w-full h-9 px-3 text-sm rounded-md outline-none"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
