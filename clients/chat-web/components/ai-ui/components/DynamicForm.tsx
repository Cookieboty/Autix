import React, { useState } from 'react';
import {
  Card,
  Button,
  Form,
  TextField,
  Label,
  Input,
  TextArea,
  Select,
  ListBox,
  DatePicker,
  DateField,
  Calendar,
  Checkbox,
  FieldError,
  Badge
} from '@heroui/react';
import { UIForm, UIActionCallback } from '@/types/ai-ui';

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
  const [formData, setFormData] = useState<Record<string, any>>(submittedData || {});
  
  // 检查所有必填字段是否已填写
  const isFormValid = () => {
    return fields.every(field => {
      if (!field.required) return true;
      const value = formData[field.name];
      return value !== undefined && value !== null && value !== '';
    });
  };

  // 如果已有提交数据且禁用,显示只读模式
  if (disabled && submittedData) {
    return (
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <Card.Title>{title}</Card.Title>
            <Badge color="success" variant="soft">已提交</Badge>
          </div>
          {description && <Card.Description className="text-sm">{description}</Card.Description>}
        </Card.Header>
        <Card.Content>
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.name} className="flex items-start gap-3 py-2">
                <Label className="w-32 shrink-0 pt-1 text-sm font-medium">
                  {field.label}
                </Label>
                <div className="flex-1">
                  <p className="text-sm rounded-md bg-default-100 px-3 py-2 border border-default-200">
                    {submittedData[field.name] || <span className="text-default-400">未填写</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card.Content>
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

    // Merge with date and select values from state
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
        {field.required && <span className="text-danger ml-0.5">*</span>}
      </Label>
    );

    switch (field.fieldType) {
      case 'input':
      case 'number':
        return (
          <div key={field.name} className="flex items-start gap-3">
            {labelEl}
            <div className="flex-1 min-w-0">
              <TextField
                name={field.name}
                type={field.fieldType === 'number' ? 'number' : 'text'}
                isRequired={field.required ?? false}
                isDisabled={disabled}
                defaultValue={field.defaultValue?.toString() ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e }))}
              >
                <Input placeholder={field.placeholder ?? undefined} />
                <FieldError />
              </TextField>
            </div>
          </div>
        );

      case 'textarea':
        return (
          <div key={field.name} className="flex items-start gap-3">
            {labelEl}
            <div className="flex-1 min-w-0">
              <TextField
                name={field.name}
                isRequired={field.required ?? false}
                isDisabled={disabled}
                defaultValue={field.defaultValue?.toString() ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e }))}
              >
                <TextArea placeholder={field.placeholder ?? undefined} rows={3} />
                <FieldError />
              </TextField>
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="flex items-start gap-3">
            {labelEl}
            <div className="flex-1 min-w-0">
              <Select
                name={field.name}
                placeholder={field.placeholder ?? '请选择'}
                isRequired={field.required ?? false}
                isDisabled={disabled}
                defaultSelectedKey={field.defaultValue?.toString()}
                onSelectionChange={(key) => {
                  setFormData(prev => ({
                    ...prev,
                    [field.name]: String(key)
                  }));
                }}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {field.options?.map((opt) => (
                      <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                        {opt.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
                <FieldError />
              </Select>
            </div>
          </div>
        );

      case 'date':
        return (
          <div key={field.name} className="flex items-start gap-3">
            {labelEl}
            <div className="flex-1 min-w-0">
              <DatePicker
                name={field.name}
                isRequired={field.required ?? false}
                isDisabled={disabled}
                className="w-full"
                onChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    [field.name]: value?.toString()
                  }));
                }}
              >
                <DateField.Group className="w-full">
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger>
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover>
                  <Calendar>
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger>
                        <Calendar.YearPickerTriggerHeading />
                        <Calendar.YearPickerTriggerIndicator />
                      </Calendar.YearPickerTrigger>
                      <Calendar.NavButton slot="previous" />
                      <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        {(date) => <Calendar.Cell date={date} />}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
                <FieldError />
              </DatePicker>
            </div>
          </div>
        );

      case 'checkbox':
        const checkboxId = `checkbox-${field.name}`;
        return (
          <div key={field.name} className="flex items-start gap-3">
            <div className="w-24 shrink-0" />
            <div className="flex-1 min-w-0">
              <Checkbox
                id={checkboxId}
                isDisabled={disabled}
                isSelected={formData[field.name] ?? (field.defaultValue === true)}
                onChange={(isSelected) => {
                  setFormData(prev => ({
                    ...prev,
                    [field.name]: isSelected
                  }));
                }}
              >
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content>
                  <Label htmlFor={checkboxId} className="text-sm text-foreground/70">
                    {field.label}
                  </Label>
                </Checkbox.Content>
              </Checkbox>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full " variant="secondary">
      {title && (
        <Card.Header>
          <Card.Title>{title}</Card.Title>
        </Card.Header>
      )}

      <Card.Content>
        <Form
          className="flex flex-col gap-4 w-full"
          onSubmit={handleSubmit}
        >
          {fields.map(renderField)}

          <div className="flex gap-2 justify-end">
            <Button
              type="submit"
              variant="primary"
              isDisabled={disabled || !isFormValid()}
            >
              提交
            </Button>
            <Button
              type="button"
              variant="ghost"
              onPress={() => onAction('cancel', {})}
              isDisabled={disabled}
            >
              取消
            </Button>
          </div>
        </Form>
      </Card.Content>
    </Card>
  );
}
