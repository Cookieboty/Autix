'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';
import { Calendar } from '../../ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '../../ui/popover';
import { useTranslations } from 'next-intl';
import type { UIForm, UIActionCallback } from '@autix/shared-store';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface DynamicFormProps extends UIForm, UIActionCallback {
  submittedData?: Record<string, any>;
}

export function DynamicForm({
  title,
  description,
  fields,
  onAction,
  disabled,
  submittedData,
}: DynamicFormProps) {
  const t = useTranslations('aiUi');
  const [formData, setFormData] = useState<Record<string, any>>(submittedData || {});
  const [datePickerOpen, setDatePickerOpen] = useState<Record<string, boolean>>({});
  const isFormValid = () => {
    return fields.every(field => {
      if (!field.required) return true;
      const value = formData[field.name];
      return value !== undefined && value !== null && value !== '';
    });
  };

  if (disabled && submittedData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">{t('submitted')}</Badge>
          </div>
          {description && <CardDescription className="text-sm">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.name} className="flex items-start gap-3 py-2">
                <Label className="w-32 shrink-0 pt-1 text-sm font-medium">
                  {field.label}
                </Label>
                <div className="flex-1">
                  <p className="text-sm rounded-md bg-muted px-3 py-2 border border-border">
                    {submittedData[field.name] || <span className="text-muted-foreground">{t('notFilled')}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = new FormData(e.currentTarget);
    const result: Record<string, any> = {};

    data.forEach((value, key) => {
      result[key] = value.toString();
    });

    Object.keys(formData).forEach(key => {
      if (formData[key] !== undefined) {
        result[key] = formData[key];
      }
    });

    onAction('submit', result);
  };

  const renderField = (field: UIForm['fields'][0]) => {
    const labelEl = (
      <Label className="w-24 shrink-0 pt-2 text-sm text-foreground/70">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
    );

    switch (field.fieldType) {
      case 'input':
      case 'number':
        return (
          <div key={field.name} className="flex items-start gap-3">
            {labelEl}
            <div className="flex-1 min-w-0">
              <Input
                name={field.name}
                type={field.fieldType === 'number' ? 'number' : 'text'}
                aria-label={field.label}
                required={field.required ?? false}
                disabled={disabled}
                defaultValue={field.defaultValue?.toString() ?? ''}
                placeholder={field.placeholder ?? undefined}
                onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
              />
            </div>
          </div>
        );

      case 'textarea':
        return (
          <div key={field.name} className="flex items-start gap-3">
            {labelEl}
            <div className="flex-1 min-w-0">
              <Textarea
                name={field.name}
                aria-label={field.label}
                required={field.required ?? false}
                disabled={disabled}
                defaultValue={field.defaultValue?.toString() ?? ''}
                placeholder={field.placeholder ?? undefined}
                rows={3}
                onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
              />
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="flex items-start gap-3">
            {labelEl}
            <div className="flex-1 min-w-0">
              <Select
                value={formData[field.name] || field.defaultValue?.toString() || ''}
                onValueChange={(val) => {
                  setFormData(prev => ({ ...prev, [field.name]: val }));
                }}
                disabled={disabled}
              >
                <SelectTrigger aria-label={field.label}>
                  <SelectValue placeholder={field.placeholder ?? t('pleaseSelect')} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name={field.name} value={formData[field.name] || ''} />
            </div>
          </div>
        );

      case 'date':
        return (
          <div key={field.name} className="flex items-start gap-3">
            {labelEl}
            <div className="flex-1 min-w-0">
              <Popover
                open={datePickerOpen[field.name] || false}
                onOpenChange={(open) => setDatePickerOpen(prev => ({ ...prev, [field.name]: open }))}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    disabled={disabled}
                    type="button"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData[field.name] ? format(new Date(formData[field.name]), 'PPP') : field.placeholder ?? t('pleaseSelect')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData[field.name] ? new Date(formData[field.name]) : undefined}
                    onSelect={(date) => {
                      setFormData(prev => ({ ...prev, [field.name]: date?.toISOString() }));
                      setDatePickerOpen(prev => ({ ...prev, [field.name]: false }));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <input type="hidden" name={field.name} value={formData[field.name] || ''} />
            </div>
          </div>
        );

      case 'checkbox': {
        const checkboxId = `checkbox-${field.name}`;
        return (
          <div key={field.name} className="flex items-start gap-3">
            <div className="w-24 shrink-0" />
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                disabled={disabled}
                checked={formData[field.name] ?? (field.defaultValue === true)}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({ ...prev, [field.name]: checked }));
                }}
              />
              <Label htmlFor={checkboxId} className="text-sm text-foreground/70 cursor-pointer">
                {field.label}
              </Label>
              <input type="hidden" name={field.name} value={formData[field.name] ? 'true' : 'false'} />
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}

      <CardContent>
        <form
          className="flex flex-col gap-4 w-full"
          onSubmit={handleSubmit}
        >
          {fields.map(renderField)}

          <div className="flex gap-2 justify-end">
            <Button
              type="submit"
              disabled={disabled || !isFormValid()}
            >
              {t('submit')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onAction('cancel', {})}
              disabled={disabled}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
