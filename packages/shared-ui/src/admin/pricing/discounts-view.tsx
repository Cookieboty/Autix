'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '../../ui/dialog';
import type {
  CreateDiscountInput,
  PricingDiscount,
  PricingDiscountScope,
  UpdateDiscountInput,
} from '@autix/shared-store';

export interface DiscountsViewProps {
  discounts: PricingDiscount[];
  saving?: boolean;
  error?: string | null;
  onCreate: (data: CreateDiscountInput) => void;
  onUpdate: (id: string, data: UpdateDiscountInput) => void;
  onDelete: (id: string) => void;
}

type DiscountForm = {
  code: string;
  name: string;
  factor: number;
  membershipLevelNumbers: number[];
  taskTypes: string[];
  modelConfigIds: string[];
  stackable: boolean;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};

const EMPTY_FORM: DiscountForm = {
  code: '',
  name: '',
  factor: 1,
  membershipLevelNumbers: [],
  taskTypes: [],
  modelConfigIds: [],
  stackable: false,
  priority: 0,
  effectiveFrom: '',
  effectiveTo: '',
  isActive: true,
};

/** `discount.factor` arrives over the wire as a Decimal string (e.g. "0.900"); convert with
 * `Number(...)` for display/editing — never do string arithmetic on it. */
function formFromDiscount(discount: PricingDiscount): DiscountForm {
  return {
    code: discount.code,
    name: discount.name,
    factor: Number(discount.factor),
    membershipLevelNumbers: discount.scope.membershipLevelNumbers ?? [],
    taskTypes: discount.scope.taskTypes ?? [],
    modelConfigIds: discount.scope.modelConfigIds ?? [],
    stackable: discount.stackable,
    priority: discount.priority,
    effectiveFrom: toLocalInputValue(discount.effectiveFrom),
    effectiveTo: toLocalInputValue(discount.effectiveTo),
    isActive: discount.isActive,
  };
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function scopeFromForm(form: DiscountForm): PricingDiscountScope {
  const scope: PricingDiscountScope = {};
  if (form.membershipLevelNumbers.length > 0) scope.membershipLevelNumbers = form.membershipLevelNumbers;
  if (form.taskTypes.length > 0) scope.taskTypes = form.taskTypes;
  if (form.modelConfigIds.length > 0) scope.modelConfigIds = form.modelConfigIds;
  return scope;
}

/** `t` is `useTranslations('adminPricing.discounts')` — the same namespace `DiscountsView`
 * already scopes `t` to below. */
function scopeSummary(scope: PricingDiscountScope, t: ReturnType<typeof useTranslations>): string[] {
  const parts: string[] = [];
  if (scope.membershipLevelNumbers?.length) {
    parts.push(t('scopeSummary.levels', { values: scope.membershipLevelNumbers.join(',') }));
  }
  if (scope.taskTypes?.length) {
    parts.push(t('scopeSummary.tasks', { values: scope.taskTypes.join(',') }));
  }
  if (scope.modelConfigIds?.length) {
    parts.push(t('scopeSummary.models', { values: scope.modelConfigIds.join(',') }));
  }
  return parts;
}

function TagListField({
  label,
  values,
  placeholder,
  onChange,
  parse = (raw) => raw,
}: {
  label: string;
  values: (string | number)[];
  placeholder: string;
  onChange: (values: (string | number)[]) => void;
  parse?: (raw: string) => string | number | null;
}) {
  const [draft, setDraft] = useState('');

  const addValue = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const parsed = parse(trimmed);
    if (parsed === null || parsed === '' || (typeof parsed === 'number' && Number.isNaN(parsed))) return;
    if (values.includes(parsed)) {
      setDraft('');
      return;
    }
    onChange([...values, parsed]);
    setDraft('');
  };

  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
        {values.map((value) => (
          <span
            key={value}
            className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground"
          >
            {value}
            <button
              type="button"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => onChange(values.filter((existing) => existing !== value))}
              aria-label={`remove ${value}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addValue();
            }
          }}
          onBlur={addValue}
          placeholder={values.length === 0 ? placeholder : ''}
          className="min-w-[80px] flex-1 bg-transparent text-xs outline-none"
        />
      </div>
    </div>
  );
}

export function DiscountsView({ discounts, saving, error, onCreate, onUpdate, onDelete }: DiscountsViewProps) {
  const t = useTranslations('adminPricing.discounts');
  const tCommon = useTranslations('common');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: DiscountForm } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => setModal({ mode: 'create', form: { ...EMPTY_FORM } });
  const openEdit = (discount: PricingDiscount) =>
    setModal({ mode: 'edit', id: discount.id, form: formFromDiscount(discount) });
  const closeModal = () => setModal(null);

  const handleSave = () => {
    if (!modal) return;
    const scope = scopeFromForm(modal.form);
    if (modal.mode === 'create') {
      onCreate({
        code: modal.form.code.trim(),
        name: modal.form.name.trim(),
        factor: modal.form.factor,
        scope,
        stackable: modal.form.stackable,
        priority: modal.form.priority,
        effectiveFrom: fromLocalInputValue(modal.form.effectiveFrom),
        effectiveTo: fromLocalInputValue(modal.form.effectiveTo),
      });
    } else if (modal.id) {
      onUpdate(modal.id, {
        name: modal.form.name.trim(),
        factor: modal.form.factor,
        scope,
        stackable: modal.form.stackable,
        priority: modal.form.priority,
        isActive: modal.form.isActive,
        effectiveFrom: fromLocalInputValue(modal.form.effectiveFrom),
        effectiveTo: fromLocalInputValue(modal.form.effectiveTo),
      });
    }
    closeModal();
  };

  const canSave = modal
    ? modal.form.name.trim().length > 0 && (modal.mode === 'edit' || modal.form.code.trim().length > 0)
    : false;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t('title')}</h1>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <Button size="sm" className="cursor-pointer" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t('add')}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-lg border bg-surface">
        {discounts.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.code')}</TableHead>
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead>{t('columns.factor')}</TableHead>
                <TableHead>{t('columns.scope')}</TableHead>
                <TableHead>{t('columns.stackable')}</TableHead>
                <TableHead>{t('columns.priority')}</TableHead>
                <TableHead>{t('columns.effectiveWindow')}</TableHead>
                <TableHead>{t('columns.isActive')}</TableHead>
                <TableHead className="text-right">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((discount) => (
                <TableRow key={discount.id}>
                  <TableCell className="font-mono text-xs">{discount.code}</TableCell>
                  <TableCell>{discount.name}</TableCell>
                  <TableCell>{Number(discount.factor)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {scopeSummary(discount.scope, t).length === 0
                        ? t('scopeAll')
                        : scopeSummary(discount.scope, t).map((line) => <span key={line}>{line}</span>)}
                    </div>
                  </TableCell>
                  <TableCell>{discount.stackable ? tCommon('yes') : tCommon('no')}</TableCell>
                  <TableCell>{discount.priority}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {discount.effectiveFrom ?? '—'} ~ {discount.effectiveTo ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={discount.isActive}
                      onCheckedChange={(checked) => onUpdate(discount.id, { isActive: checked })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 cursor-pointer px-2"
                        onClick={() => openEdit(discount)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        {tCommon('edit')}
                      </Button>
                      {deletingId === discount.id ? (
                        <>
                          <Button
                            size="sm"
                            className="h-8 cursor-pointer bg-destructive px-2 text-white"
                            onClick={() => {
                              onDelete(discount.id);
                              setDeletingId(null);
                            }}
                          >
                            {tCommon('confirm')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 cursor-pointer px-2"
                            onClick={() => setDeletingId(null)}
                          >
                            {tCommon('cancel')}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 cursor-pointer px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeletingId(discount.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          {tCommon('delete')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!modal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{modal?.mode === 'create' ? t('add') : t('edit')}</DialogTitle>
          </DialogHeader>
          {modal && (
            <DialogBody className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">{t('fields.code')}</Label>
                  <Input
                    value={modal.form.code}
                    disabled={modal.mode === 'edit'}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, code: e.target.value } })}
                    placeholder="SUMMER25"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">{t('fields.name')}</Label>
                  <Input
                    value={modal.form.name}
                    onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">{t('fields.factor')}</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={modal.form.factor}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, factor: Number(e.target.value) } })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1.5">{t('fields.priority')}</Label>
                  <Input
                    type="number"
                    step="1"
                    value={modal.form.priority}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, priority: Number(e.target.value) } })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1.5">{t('fields.effectiveFrom')}</Label>
                  <Input
                    type="datetime-local"
                    value={modal.form.effectiveFrom}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, effectiveFrom: e.target.value } })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1.5">{t('fields.effectiveTo')}</Label>
                  <Input
                    type="datetime-local"
                    value={modal.form.effectiveTo}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, effectiveTo: e.target.value } })
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <p className="text-xs font-medium text-foreground">{t('fields.scope')}</p>
                <TagListField
                  label={t('fields.membershipLevelNumbers')}
                  values={modal.form.membershipLevelNumbers}
                  placeholder={t('scopePlaceholders.membershipLevelNumbers')}
                  parse={(raw) => {
                    const n = Number(raw);
                    return Number.isFinite(n) ? n : null;
                  }}
                  onChange={(values) =>
                    setModal({
                      ...modal,
                      form: { ...modal.form, membershipLevelNumbers: values as number[] },
                    })
                  }
                />
                <TagListField
                  label={t('fields.taskTypes')}
                  values={modal.form.taskTypes}
                  placeholder={t('scopePlaceholders.taskTypes')}
                  onChange={(values) =>
                    setModal({ ...modal, form: { ...modal.form, taskTypes: values as string[] } })
                  }
                />
                <TagListField
                  label={t('fields.modelConfigIds')}
                  values={modal.form.modelConfigIds}
                  placeholder={t('scopePlaceholders.modelConfigIds')}
                  onChange={(values) =>
                    setModal({ ...modal, form: { ...modal.form, modelConfigIds: values as string[] } })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>{t('fields.stackable')}</Label>
                <Switch
                  checked={modal.form.stackable}
                  onCheckedChange={(checked) =>
                    setModal({ ...modal, form: { ...modal.form, stackable: checked } })
                  }
                />
              </div>

              {modal.mode === 'edit' && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>{t('fields.isActive')}</Label>
                  <Switch
                    checked={modal.form.isActive}
                    onCheckedChange={(checked) =>
                      setModal({ ...modal, form: { ...modal.form, isActive: checked } })
                    }
                  />
                </div>
              )}
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={closeModal}>
              {tCommon('cancel')}
            </Button>
            <Button className="cursor-pointer" disabled={!canSave || !!saving} onClick={handleSave}>
              {saving ? tCommon('saving') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
