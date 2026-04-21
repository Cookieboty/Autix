import React, { useState } from 'react';
import { Card, Button, Radio, RadioGroup, Checkbox, CheckboxGroup, Label, Description, Badge } from '@heroui/react';
import type { Selection } from '@heroui/react';
import { UISelection, UIActionCallback } from '@/types/ai-ui';
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
  // 从 selectedValue 初始化状态
  const initSelected = (): Selection => {
    if (!selectedValue) return new Set();
    if (Array.isArray(selectedValue)) {
      return new Set(selectedValue);
    }
    return new Set([selectedValue]);
  };
  
  const [selected, setSelected] = useState<Selection>(initSelected());

  const handleChange = (value: Selection) => {
    const normalizedValue = typeof value === 'string' ? new Set([value]) : value;
    setSelected(normalizedValue);
  };

  const getSelectedArray = (): string[] => {
    if (selected === 'all') {
      return options.map(opt => opt.value);
    }
    if (selected instanceof Set) {
      return Array.from(selected) as string[];
    }
    return [];
  };

  const getSelectedSize = (): number => {
    if (selected === 'all') return options.length;
    if (selected instanceof Set) return selected.size;
    return 0;
  };

  const handleSubmit = () => {
    const selectedArray = getSelectedArray();
    if (selectedArray.length === 0) return;

    onAction('submit', {
      selectedType: selectedArray[0],
      selectedOptions: selectedArray,
    });
  };
  
  // 如果已有选择且禁用,显示只读模式
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
        <Card.Header>
          <div className="flex items-center justify-between">
            <Card.Title>{question}</Card.Title>
            <Badge color="success" variant="soft">已选择</Badge>
          </div>
        </Card.Header>
        <Card.Content>
          <div className="flex flex-wrap gap-2">
            {selectedLabels.map((label, idx) => (
              <Badge key={idx} color="accent" variant="soft">
                {label}
              </Badge>
            ))}
          </div>
        </Card.Content>
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
      <Card.Header>
        <Card.Title>{question}</Card.Title>
      </Card.Header>

      <Card.Content>
      {multiSelect ? (
        <CheckboxGroup
          aria-label={question}
          value={selected as any}
          onChange={handleChange as any}
          isDisabled={disabled}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {options.map((option) => {
              const isChecked = selected instanceof Set && selected.has(option.value);
              return (
                <label
                  key={option.value}
                  className={clsx(
                    "group relative flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all",
                    isChecked
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-default-200 bg-default-50 hover:border-default-400"
                  )}
                >
                  <Checkbox
                    value={option.value}
                    className="sr-only"
                  />
                  <div className={clsx(
                    "shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors",
                    isChecked
                      ? "border-[var(--accent)] bg-[var(--accent)]"
                      : "border-default-300 group-hover:border-default-400"
                  )}>
                    {isChecked && (
                      <svg className="w-3 h-3 text-[var(--accent-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
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
        </CheckboxGroup>
      ) : (
        <RadioGroup
          aria-label={question}
          value={selected as any}
          onChange={handleChange as any}
          isDisabled={disabled}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {options.map((option) => {
              const isActive = selected instanceof Set && selected.has(option.value);
              return (
                <label
                  key={option.value}
                  className={clsx(
                    "group relative flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all",
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-default-200 bg-default-50 hover:border-default-400"
                  )}
                >
                  <Radio
                    value={option.value}
                    className="sr-only"
                  />
                  <div className={clsx(
                    "shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-colors",
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)]"
                      : "border-default-300 group-hover:border-default-400"
                  )}>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-[var(--accent-foreground)]" />
                    )}
                  </div>
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
      </Card.Content>

      <Card.Footer className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onPress={() => onAction('cancel', {})}
          isDisabled={disabled}
        >
          取消
        </Button>
        <Button
          variant="primary"
          onPress={handleSubmit}
          isDisabled={disabled || getSelectedSize() === 0}
        >
          确认
        </Button>
      </Card.Footer>
    </Card>
  );
}
