'use client';

import { useRef, useState } from 'react';
import {
  useExportAdminPricingRulesMutation,
  useImportAdminPricingRulesMutation,
} from '@autix/shared-store';
import { Download, Upload } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui';
import type { MembershipLevel, ModelConfigItem } from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  modelsForBusinessTask,
  pricingScopeContext,
  scopeOptionsForTask,
  showScopeField,
  type ScopeField,
  type Translate,
} from './task-costs-helpers';

interface ImportResult {
  created: number;
  updated: number;
  errors: Array<{ row: number; name?: string; reason: string }>;
  dryRun: boolean;
}

function errorMessage(error: unknown, fallback: string) {
  const axiosErr = error as { response?: { data?: { message?: string } }; message?: string };
  return axiosErr?.response?.data?.message ?? axiosErr?.message ?? fallback;
}

/**
 * Bulk Excel toolbar for pricing rules: pick a task, export the current rules as
 * a fillable .xlsx, or upload a filled one. Upload always dry-runs first and
 * shows a per-row diff/error preview before the admin confirms the real import.
 */
interface TaskCostsBulkExcelProps {
  systemModels: ModelConfigItem[];
  membershipLevels: MembershipLevel[];
  tAdmin: Translate;
}

export function TaskCostsBulkExcel({ systemModels, membershipLevels, tAdmin }: TaskCostsBulkExcelProps) {
  const [taskType, setTaskType] = useState<string>(BUSINESS_TASKS[0]?.taskType ?? '');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportMutation = useExportAdminPricingRulesMutation();
  const importMutation = useImportAdminPricingRulesMutation();

  const handleExport = async () => {
    setError(null);
    const task = BUSINESS_TASKS.find((item) => item.taskType === taskType);
    if (!task) return;
    try {
      const scopeModels = modelsForBusinessTask(task, systemModels);
      const context = pricingScopeContext(membershipLevels);
      const dimValues = (field: ScopeField) =>
        showScopeField(task, field)
          ? scopeOptionsForTask(task, field, scopeModels, context).map((option) => option.value)
          : [];
      const blob = await exportMutation.mutateAsync({
        taskType,
        models: scopeModels.map((model) => ({ provider: model.provider, modelName: model.model })),
        qualities: dimValues('quality'),
        resolutions: dimValues('resolution'),
        modelTiers: dimValues('modelTier'),
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `pricing-rules-${taskType}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, tAdmin('bulk.exportFailed')));
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;
    setPendingFile(file);
    setResult(null);
    setError(null);
    setDialogOpen(true);
    try {
      const preview = await importMutation.mutateAsync({ file, taskType, dryRun: true });
      setResult(preview);
    } catch (err) {
      setError(errorMessage(err, tAdmin('bulk.parseFailed')));
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    setError(null);
    try {
      const applied = await importMutation.mutateAsync({
        file: pendingFile,
        taskType,
        dryRun: false,
      });
      setResult(applied);
      if (applied.errors.length === 0) {
        setDialogOpen(false);
        setPendingFile(null);
      }
    } catch (err) {
      setError(errorMessage(err, tAdmin('bulk.importFailed')));
    }
  };

  const hasErrors = (result?.errors.length ?? 0) > 0;
  const canConfirm = !!result && result.dryRun && !hasErrors && !importMutation.isPending;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <span className="text-sm text-muted-foreground">{tAdmin('bulk.title')}</span>
      <Select value={taskType} onValueChange={setTaskType}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder={tAdmin('bulk.selectTask')} />
        </SelectTrigger>
        <SelectContent>
          {BUSINESS_TASKS.map((task) => (
            <SelectItem key={task.taskType} value={task.taskType}>
              {task.defaultName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={exportMutation.isPending || !taskType}
      >
        <Download className="mr-1 size-4" />
        {tAdmin('bulk.exportTemplate')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={!taskType}
      >
        <Upload className="mr-1 size-4" />
        {tAdmin('bulk.import')}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleFileSelected}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tAdmin('bulk.previewTitle', { taskType })}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {importMutation.isPending && !result && (
              <p className="text-sm text-muted-foreground">{tAdmin('bulk.validating')}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {result && (
              <div className="space-y-3">
                <p className="text-sm">
                  {tAdmin('bulk.created')} <span className="font-semibold">{result.created}</span> · {tAdmin('bulk.updated')}{' '}
                  <span className="font-semibold">{result.updated}</span> · {tAdmin('bulk.errors')}{' '}
                  <span className="font-semibold">{result.errors.length}</span>
                  {result.dryRun ? tAdmin('bulk.dryRunSuffix') : tAdmin('bulk.appliedSuffix')}
                </p>
                {hasErrors && (
                  <div className="max-h-64 overflow-y-auto rounded border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-2 py-1">{tAdmin('bulk.row')}</th>
                          <th className="px-2 py-1">name</th>
                          <th className="px-2 py-1">{tAdmin('bulk.reason')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((item, index) => (
                          <tr key={`${item.row}-${index}`} className="border-t">
                            <td className="px-2 py-1">{item.row}</td>
                            <td className="px-2 py-1">{item.name ?? '-'}</td>
                            <td className="px-2 py-1 text-destructive">{item.reason}</td>
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
              {tAdmin('bulk.close')}
            </Button>
            <Button onClick={handleConfirmImport} disabled={!canConfirm}>
              {tAdmin('bulk.confirmImport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
