'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { useTranslations } from 'next-intl';
import { UISelection, UIActionCallback } from '@autix/shared-lib';
import clsx from 'clsx';

interface SelectionCardProps extends UISelection, UIActionCallback {
  selectedValue?: string | string[];
}

export function SelectionCard({
  question,
  options,
  multiSelect,
  maxSelections,
  onAction,
  disabled,
  selectedValue,
}: SelectionCardProps) {
  const t = useTranslations('aiUi');
  const initSelected = (): Set<string> => {
    if (!selectedValue) return new Set();
    if (Array.isArray(selectedValue)) {
      return new Set(selectedValue);
    }
    return new Set([selectedValue]);
  };

  const [selected, setSelected] = useState<Set<string>>(initSelected());

  const handleChange = (value: string | Set<string>) => {
    const normalizedValue = typeof value === 'string' ? new Set([value]) : value;
    setSelected(normalizedValue);
  };

  const getSelectedArray = (): string[] => {
    return Array.from(selected) as string[];
  };

  const getSelectedSize = (): number => {
    return selected.size;
  };

  const handleSubmit = () => {
    const selectedArray = getSelectedArray();
    if (selectedArray.length === 0) return;

    onAction('submit', {
      selectedType: selectedArray[0],
      selectedOptions: selectedArray,
    });
  };

  if (disabled && selectedValue) {
    const selectedArray = Array.isArray(selectedValue) ? selectedValue : [selectedValue];
    const selectedLabels = options
      .filter(opt => selectedArray.includes(opt.value))
      .map(opt => opt.label);

    return (
      <Card
        style={{
          '--accent': '#006FEE',
          '--accent-foreground': '#fff',
        } as React.CSSProperties}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{question}</CardTitle>
            <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">{t('selected')}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {selectedLabels.map((label, idx) => (
              <Badge key={idx} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      style={{
        '--accent': '#006FEE',
        '--accent-foreground': '#fff',
      } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle>{question}</CardTitle>
      </CardHeader>

      <CardContent>
      {multiSelect ? (
        <div className="grid gap-3 md:grid-cols-2">
          {options.map((option) => {
            const isChecked = selected.has(option.value);
            return (
              <label
                key={option.value}
                className={clsx(
                  "group relative flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all",
                  isChecked
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-border bg-background hover:border-foreground/20"
                )}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const next = new Set(selected);
                    if (checked) next.add(option.value);
                    else next.delete(option.value);
                    setSelected(next);
                  }}
                  className="mt-0.5"
                  disabled={disabled}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-foreground/50">{option.description}</span>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <RadioGroup
          value={getSelectedArray()[0] || ''}
          onValueChange={(val) => handleChange(val)}
          disabled={disabled}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {options.map((option) => {
              const isActive = selected.has(option.value);
              return (
                <label
                  key={option.value}
                  className={clsx(
                    "group relative flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all",
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-border bg-background hover:border-foreground/20"
                  )}
                >
                  <RadioGroupItem
                    value={option.value}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-foreground/50">{option.description}</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </RadioGroup>
      )}
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => onAction('cancel', {})}
          disabled={disabled}
        >
          {t('cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={disabled || getSelectedSize() === 0}
        >
          {t('confirm')}
        </Button>
      </CardFooter>
    </Card>
  );
}
