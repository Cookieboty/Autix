'use client';

import type { TemplateVariable } from '@autix/shared-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

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
          <label className="text-xs font-medium text-foreground">
            {v.label}
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
              {`{{${v.key}}}`}
            </span>
          </label>
          {v.options && v.options.length > 0 ? (
            <Select
              value={values[v.key] ?? v.default ?? ''}
              onValueChange={(val) => update(v.key, val)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {v.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <input
              value={values[v.key] ?? v.default ?? ''}
              onChange={(e) => update(v.key, e.target.value)}
              placeholder={v.default ?? ''}
              className="w-full h-9 px-3 text-sm rounded-md outline-none border border-input bg-background text-foreground"
            />
          )}
        </div>
      ))}
    </div>
  );
}
