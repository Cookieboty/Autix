'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Upload } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui';
import type {
  PricingDiscount,
  TaskModelBinding,
  UpdateDiscountInput,
  UpdateTaskModelBindingInput,
} from '@autix/shared-store';
import {
  bindingsToRows,
  discountsToRows,
  rowsToBindingPatches,
  rowsToDiscountPatches,
  type BindingRow,
  type DiscountRow,
} from './pricing-admin-helpers';

/**
 * Degraded Excel (spec §5.3): the old `task-costs-bulk-excel.tsx` round-trips whole pricing rules
 * (conditions + components) as `.xlsx` via a *server-side* encode/decode
 * (`useExportAdminPricingRulesMutation`/`useImportAdminPricingRulesMutation` — that file has no
 * CSV/Excel library import of its own, because the actual parsing happens in services/api). This
 * component has no backend counterpart: it only covers two scalar knobs
 * (`task_model_bindings.multiplier`, `pricing_discounts.factor`), so the CSV encode/decode below is
 * hand-rolled and runs entirely in the browser rather than adding a new dependency for two columns.
 */

function csvEscape(value: string | number): string {
  const str = String(value);
  return /["\n,]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv<T>(headers: Array<keyof T & string>, rows: T[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] as unknown as string | number)).join(','));
  }
  return lines.join('\n');
}

/** Parses a single CSV line, honoring double-quote-wrapped cells with `""`-escaped quotes. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function fromCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0] ?? '');
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

interface RowError {
  row: number;
  key: string;
  reason: RowRejectionReason;
}

interface ImportPreview<TPatch> {
  patches: TPatch[];
  errors: RowError[];
}

/** Machine-stable codes for rejected-row reasons. `previewBindingRows`/`previewDiscountRows` run
 * outside React (no `useTranslations` access), so they emit these codes rather than user-facing
 * text; the dialog resolves each code to a localized string via `t(\`reason.${code}\`)` at render
 * time (see `ScalarExcelSection`). */
type RowRejectionReason =
  | 'missingTaskType'
  | 'missingModelConfigId'
  | 'multiplierInvalid'
  | 'missingCode'
  | 'factorInvalid';

/** Presentational duplicate of `rowsToBindingPatches`'s validity rules, kept only to surface a
 * human-readable reason per rejected row in the preview dialog. Final gating for what actually
 * gets applied still goes through `rowsToBindingPatches` itself — this never decides on its own. */
function previewBindingRows(rawRows: Array<Record<string, string>>): ImportPreview<BindingRow> {
  const errors: RowError[] = [];
  rawRows.forEach((raw, index) => {
    const key = `${raw.taskType ?? '?'} / ${raw.modelConfigId ?? '?'}`;
    if (!raw.taskType?.trim()) {
      errors.push({ row: index + 2, key, reason: 'missingTaskType' });
      return;
    }
    if (!raw.modelConfigId?.trim()) {
      errors.push({ row: index + 2, key, reason: 'missingModelConfigId' });
      return;
    }
    const multiplier = Number(raw.multiplier);
    if (!raw.multiplier?.trim() || !Number.isFinite(multiplier)) {
      errors.push({ row: index + 2, key, reason: 'multiplierInvalid' });
    }
  });
  return { patches: rowsToBindingPatches(rawRows), errors };
}

function previewDiscountRows(rawRows: Array<Record<string, string>>): ImportPreview<DiscountRow> {
  const errors: RowError[] = [];
  rawRows.forEach((raw, index) => {
    const key = raw.code ?? '?';
    if (!raw.code?.trim()) {
      errors.push({ row: index + 2, key, reason: 'missingCode' });
      return;
    }
    const factor = Number(raw.factor);
    if (!raw.factor?.trim() || !Number.isFinite(factor)) {
      errors.push({ row: index + 2, key, reason: 'factorInvalid' });
    }
  });
  return { patches: rowsToDiscountPatches(rawRows), errors };
}

export interface PricingExcelScalarsProps {
  bindings: TaskModelBinding[];
  discounts: PricingDiscount[];
  onUpdateBinding: (
    taskType: string,
    modelConfigId: string,
    patch: Pick<UpdateTaskModelBindingInput, 'multiplier'>,
  ) => void | Promise<unknown>;
  onUpdateDiscount: (id: string, patch: Pick<UpdateDiscountInput, 'factor'>) => void | Promise<unknown>;
}

/** One download/upload section shared by the bindings and discounts blocks below — identical
 * shell to `TaskCostsBulkExcel`'s dialog (row-level error preview, confirm gated on zero errors),
 * just parameterized over which scalar it round-trips. */
function ScalarExcelSection<TPatch>({
  title,
  exportFilename,
  headers,
  exportRows,
  parsePreview,
  applyPatches,
  renderPatchLabel,
}: {
  title: string;
  exportFilename: string;
  headers: Array<keyof TPatch & string>;
  exportRows: () => TPatch[];
  parsePreview: (rawRows: Array<Record<string, string>>) => ImportPreview<TPatch>;
  applyPatches: (patches: TPatch[]) => Promise<unknown>;
  renderPatchLabel: (patch: TPatch) => string;
}) {
  const t = useTranslations('adminPricing.excelScalars');
  const tCommon = useTranslations('common');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview<TPatch> | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    setError(null);
    downloadCsv(exportFilename, toCsv(headers, exportRows()));
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;
    setError(null);
    setPreview(null);
    setDialogOpen(true);
    try {
      const text = await file.text();
      setPreview(parsePreview(fromCsv(text)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('readFileFailed'));
    }
  };

  const handleConfirmImport = async () => {
    if (!preview || preview.patches.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      await applyPatches(preview.patches);
      setDialogOpen(false);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importFailed'));
    } finally {
      setApplying(false);
    }
  };

  const hasErrors = (preview?.errors.length ?? 0) > 0;
  const canConfirm = !!preview && preview.patches.length > 0 && !hasErrors && !applying;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <span className="text-sm text-muted-foreground">{title}</span>

      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="mr-1 size-4" />
        {t('exportCsv')}
      </Button>

      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
        <Upload className="mr-1 size-4" />
        {t('importCsv')}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('importPreviewTitle', { title })}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {preview && (
              <div className="space-y-3">
                <p className="text-sm">
                  {t.rich('summary', {
                    valid: preview.patches.length,
                    errors: preview.errors.length,
                    bold: (chunks) => <span className="font-semibold">{chunks}</span>,
                  })}
                </p>
                {preview.patches.length > 0 && !hasErrors && (
                  <ul className="max-h-40 overflow-y-auto rounded border p-2 text-xs text-muted-foreground">
                    {preview.patches.map((patch, index) => (
                      <li key={index}>{renderPatchLabel(patch)}</li>
                    ))}
                  </ul>
                )}
                {hasErrors && (
                  <div className="max-h-64 overflow-y-auto rounded border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-2 py-1">{t('columnRow')}</th>
                          <th className="px-2 py-1">{t('columnKey')}</th>
                          <th className="px-2 py-1">{t('columnReason')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.errors.map((item, index) => (
                          <tr key={`${item.row}-${index}`} className="border-t">
                            <td className="px-2 py-1">{item.row}</td>
                            <td className="px-2 py-1">{item.key}</td>
                            <td className="px-2 py-1 text-destructive">{t(`reason.${item.reason}`)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {tCommon('close')}
            </Button>
            <Button onClick={handleConfirmImport} disabled={!canConfirm}>
              {applying ? t('applying') : t('confirmImport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Two independent download/upload blocks — one for `task_model_bindings.multiplier`, one for
 * `pricing_discounts.factor`. Each mirrors `TaskCostsBulkExcel`'s shell but is scoped to a single
 * scalar column, matching the CSV row shapes in `pricing-admin-helpers.ts`
 * (`{ taskType, modelConfigId, multiplier }[]` / `{ code, factor }[]`).
 */
export function PricingExcelScalars({
  bindings,
  discounts,
  onUpdateBinding,
  onUpdateDiscount,
}: PricingExcelScalarsProps) {
  const t = useTranslations('adminPricing.excelScalars');

  return (
    <div className="divide-y divide-border rounded-lg border bg-surface">
      <ScalarExcelSection<BindingRow>
        title={t('bindingsTitle')}
        exportFilename="task-model-bindings-multiplier.csv"
        headers={['taskType', 'modelConfigId', 'multiplier']}
        exportRows={() => bindingsToRows(bindings)}
        parsePreview={previewBindingRows}
        applyPatches={(patches) =>
          Promise.all(
            patches.map((patch) =>
              onUpdateBinding(patch.taskType, patch.modelConfigId, { multiplier: patch.multiplier }),
            ),
          )
        }
        renderPatchLabel={(patch) => `${patch.taskType} / ${patch.modelConfigId} → ${patch.multiplier}`}
      />

      <ScalarExcelSection<DiscountRow>
        title={t('discountsTitle')}
        exportFilename="pricing-discounts-factor.csv"
        headers={['code', 'factor']}
        exportRows={() => discountsToRows(discounts)}
        parsePreview={previewDiscountRows}
        applyPatches={async (patches) => {
          const byCode = new Map(discounts.map((discount) => [discount.code, discount]));
          const missing = patches.filter((patch) => !byCode.has(patch.code));
          if (missing.length > 0) {
            throw new Error(t('unknownDiscountCodes', { codes: missing.map((patch) => patch.code).join(', ') }));
          }
          return Promise.all(
            patches.map((patch) => {
              const discount = byCode.get(patch.code);
              if (!discount) return Promise.resolve();
              return onUpdateDiscount(discount.id, { factor: patch.factor });
            }),
          );
        }}
        renderPatchLabel={(patch) => `${patch.code} → ${patch.factor}`}
      />
    </div>
  );
}
