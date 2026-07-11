'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Gauge, Loader2, Plus, Power, PowerOff, Save, Search, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelConfigItem, TaskDefinition, TaskModelBinding } from '@autix/shared-store';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Skeleton } from '../../ui/skeleton';
import { Switch } from '../../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { cn } from '../../ui/utils';
import {
  bindingDraftKey,
  addTaskModelsSequentially,
  applyBulkBindingDraft,
  buildTaskBindingPatches,
  buildTaskBindingSummaries,
  filterAddableModels,
  filterTaskBindings,
  formatMultiplier,
  type BindingDraftMap,
  type BindingStatusFilter,
  type DefaultDraftMap,
  type TaskBindingPatch,
} from './task-bindings-helpers';

export interface TaskBindingsViewProps {
  bindings: TaskModelBinding[];
  taskDefinitions: TaskDefinition[];
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  availableModels: ModelConfigItem[];
  modelsLoading?: boolean;
  adding?: boolean;
  addError?: string | null;
  onSave: (patches: TaskBindingPatch[]) => Promise<unknown>;
  onAddModel: (
    taskType: string,
    modelConfigId: string,
    multiplier: number,
    isDefault: boolean,
  ) => Promise<unknown>;
  onClearError?: () => void;
  onClearAddError?: () => void;
}

function SearchInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 pl-8 text-xs"
      />
    </div>
  );
}

export function TaskBindingsView({
  bindings,
  taskDefinitions,
  loading,
  saving,
  error,
  availableModels,
  modelsLoading,
  adding,
  addError,
  onSave,
  onAddModel,
  onClearError,
  onClearAddError,
}: TaskBindingsViewProps) {
  const t = useTranslations('adminPricing.bindings');
  const [selectedTaskType, setSelectedTaskType] = useState('');
  const [taskQuery, setTaskQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BindingStatusFilter>('all');
  const [drafts, setDrafts] = useState<BindingDraftMap>({});
  const [defaultDrafts, setDefaultDrafts] = useState<DefaultDraftMap>({});
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [bulkMultiplierText, setBulkMultiplierText] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addModelIds, setAddModelIds] = useState<Set<string>>(new Set());
  const [initialMultiplierText, setInitialMultiplierText] = useState('1');
  const [addBatchRunning, setAddBatchRunning] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const summaries = useMemo(
    () => buildTaskBindingSummaries(bindings, taskDefinitions),
    [bindings, taskDefinitions],
  );
  const visibleTasks = useMemo(() => {
    const query = taskQuery.trim().toLocaleLowerCase();
    if (!query) return summaries;
    return summaries.filter((task) =>
      [task.name, task.taskType, task.category].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [summaries, taskQuery]);

  useEffect(() => {
    if (summaries.length === 0) {
      setSelectedTaskType('');
      return;
    }
    if (!summaries.some((summary) => summary.taskType === selectedTaskType)) {
      const firstPopulatedTask = summaries.find(
        (summary) => summary.isTaskActive && summary.totalCount > 0,
      );
      setSelectedTaskType((firstPopulatedTask ?? summaries[0]).taskType);
    }
  }, [selectedTaskType, summaries]);

  useEffect(() => {
    setSelectedModelIds(new Set());
    setBulkMultiplierText('');
  }, [selectedTaskType]);

  const selectedSummary = summaries.find((summary) => summary.taskType === selectedTaskType) ?? null;
  const selectedRows = bindings.filter((binding) => binding.taskType === selectedTaskType);
  const effectiveDefaultId = defaultDrafts[selectedTaskType]
    ?? selectedRows.find((row) => row.isDefault)?.modelConfigId
    ?? '';
  const filteredRows = filterTaskBindings(selectedRows, modelQuery, statusFilter, drafts);
  const { patches, invalidKeys } = buildTaskBindingPatches(bindings, drafts, defaultDrafts);
  const invalidKeySet = new Set(invalidKeys);
  const dirtyKeySet = new Set(patches.map((patch) => bindingDraftKey(patch.taskType, patch.modelConfigId)));
  const effectiveActiveCount = selectedRows.filter((row) => {
    const draft = drafts[bindingDraftKey(row.taskType, row.modelConfigId)];
    return draft?.isActive ?? row.isActive;
  }).length;
  const filteredModelIds = filteredRows.map((row) => row.modelConfigId);
  const selectedVisibleCount = filteredModelIds.filter((id) => selectedModelIds.has(id)).length;
  const allVisibleSelected = filteredModelIds.length > 0 && selectedVisibleCount === filteredModelIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const bulkMultiplier = Number(bulkMultiplierText);
  const canApplyBulkMultiplier = bulkMultiplierText.trim().length > 0
    && Number.isFinite(bulkMultiplier)
    && bulkMultiplier > 0;
  const boundModelConfigIds = new Set(selectedRows.map((row) => row.modelConfigId));
  const addableModels = filterAddableModels(
    availableModels,
    boundModelConfigIds,
    selectedSummary?.category ?? 'other',
    addQuery,
  );
  const initialMultiplier = Number(initialMultiplierText);
  const canAddModels = addModelIds.size > 0
    && initialMultiplierText.trim().length > 0
    && Number.isFinite(initialMultiplier)
    && initialMultiplier > 0;
  const busyAdding = Boolean(adding) || addBatchRunning;

  const updateDraft = (row: TaskModelBinding, patch: { multiplierText?: string; isActive?: boolean }) => {
    const key = bindingDraftKey(row.taskType, row.modelConfigId);
    setDrafts((current) => {
      const nextDraft = { ...(current[key] ?? {}), ...patch };
      if (
        nextDraft.multiplierText !== undefined
        && Number(nextDraft.multiplierText) === Number(row.multiplier)
        && nextDraft.multiplierText.trim()
      ) {
        delete nextDraft.multiplierText;
      }
      if (nextDraft.isActive === row.isActive) delete nextDraft.isActive;
      const next = { ...current };
      if (Object.keys(nextDraft).length === 0) delete next[key];
      else next[key] = nextDraft;
      return next;
    });
    setLocalError(null);
    onClearError?.();
  };

  const selectDefault = (modelConfigId: string) => {
    const persistedDefaultId = selectedRows.find((row) => row.isDefault)?.modelConfigId;
    setDefaultDrafts((current) => {
      const next = { ...current };
      if (persistedDefaultId === modelConfigId) delete next[selectedTaskType];
      else next[selectedTaskType] = modelConfigId;
      return next;
    });
    setLocalError(null);
    onClearError?.();
  };

  const toggleModelSelection = (modelConfigId: string, checked: boolean) => {
    setSelectedModelIds((current) => {
      const next = new Set(current);
      if (checked) next.add(modelConfigId);
      else next.delete(modelConfigId);
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedModelIds((current) => {
      const next = new Set(current);
      for (const modelConfigId of filteredModelIds) {
        if (checked) next.add(modelConfigId);
        else next.delete(modelConfigId);
      }
      return next;
    });
  };

  const applyBulkActive = (isActive: boolean) => {
    const skipsDefault = !isActive
      && Boolean(effectiveDefaultId)
      && selectedModelIds.has(effectiveDefaultId);
    setDrafts((current) => applyBulkBindingDraft(
      current,
      selectedRows,
      selectedModelIds,
      { isActive },
      effectiveDefaultId,
    ).drafts);
    setLocalError(skipsDefault ? t('defaultSkipped') : null);
    onClearError?.();
  };

  const applyBulkMultiplier = () => {
    if (!canApplyBulkMultiplier) {
      setLocalError(t('invalidMultiplier'));
      return;
    }
    setDrafts((current) => applyBulkBindingDraft(
      current,
      selectedRows,
      selectedModelIds,
      { multiplierText: bulkMultiplierText },
    ).drafts);
    setLocalError(null);
    onClearError?.();
  };

  const openAddDialog = () => {
    setAddQuery('');
    setAddModelIds(new Set());
    setInitialMultiplierText('1');
    onClearAddError?.();
    setAddDialogOpen(true);
  };

  const toggleAddModel = (modelConfigId: string, checked: boolean) => {
    setAddModelIds((current) => {
      const next = new Set(current);
      if (checked) next.add(modelConfigId);
      else next.delete(modelConfigId);
      return next;
    });
  };

  const handleAddModels = async () => {
    if (!canAddModels || busyAdding) return;
    const selectedIds = Array.from(addModelIds);
    onClearAddError?.();
    setAddBatchRunning(true);
    try {
      const result = await addTaskModelsSequentially(
        selectedIds,
        Boolean(effectiveDefaultId),
        (modelConfigId, isDefault) => onAddModel(
          selectedTaskType,
          modelConfigId,
          initialMultiplier,
          isDefault,
        ),
      );
      setAddModelIds((current) => {
        const next = new Set(current);
        for (const modelConfigId of result.succeededIds) next.delete(modelConfigId);
        return next;
      });
      if (result.failedIds.length === 0) setAddDialogOpen(false);
    } finally {
      setAddBatchRunning(false);
    }
  };

  const handleSave = async () => {
    if (invalidKeys.length > 0) {
      setLocalError(t('invalidMultiplier'));
      return;
    }
    if (patches.length === 0) return;
    setLocalError(null);
    try {
      await onSave(patches);
      setDrafts({});
      setDefaultDrafts({});
      setSelectedModelIds(new Set());
      setBulkMultiplierText('');
    } catch {
      // The parent exposes the localized mutation error through `error`.
    }
  };

  if (loading) {
    return (
      <div className="grid h-full min-h-[480px] grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-3 border-r p-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return <div className="grid h-full min-h-[360px] place-items-center text-sm text-muted-foreground">{t('noTasks')}</div>;
  }

  return (
    <div className="flex h-full min-h-[520px] min-w-0 flex-col lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col border-r bg-muted/10 lg:flex">
        <div className="space-y-2 border-b p-3">
          <SearchInput value={taskQuery} onChange={setTaskQuery} placeholder={t('taskSearchPlaceholder')} />
          <div className="text-[11px] text-muted-foreground">{t('taskTotal', { count: summaries.length })}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {visibleTasks.map((task) => {
              const selected = task.taskType === selectedTaskType;
              return (
                <button
                  key={task.taskType}
                  type="button"
                  onClick={() => setSelectedTaskType(task.taskType)}
                  className={cn(
                    'relative grid w-full gap-1 rounded-md px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
                    selected && 'bg-muted text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{task.name}</span>
                    {!task.defaultModelName && <CircleAlert className="size-3.5 shrink-0 text-destructive" />}
                  </span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">{task.taskType}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {t('activeCount', { active: task.activeCount, total: task.totalCount })}
                  </span>
                </button>
              );
            })}
            {visibleTasks.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">{t('noSearchResults')}</div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="border-b p-3 lg:hidden">
          <Select value={selectedTaskType} onValueChange={setSelectedTaskType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {summaries.map((task) => (
                <SelectItem key={task.taskType} value={task.taskType}>{task.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold">{selectedSummary?.name}</h2>
              {selectedSummary && (
                <Badge variant={selectedSummary.isTaskActive ? 'secondary' : 'outline'} className="rounded-md">
                  {t(`category.${selectedSummary.category}`)}
                </Badge>
              )}
              {!effectiveDefaultId && <Badge variant="destructive" className="rounded-md">{t('defaultMissing')}</Badge>}
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{selectedTaskType}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {t('activeCount', { active: effectiveActiveCount, total: selectedRows.length })}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={openAddDialog}>
              <Plus data-icon="inline-start" />
              {t('addModels')}
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <div className="min-w-[220px] flex-1 sm:max-w-sm">
            <SearchInput value={modelQuery} onChange={setModelQuery} placeholder={t('modelSearchPlaceholder')} />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BindingStatusFilter)}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('statusAll')}</SelectItem>
              <SelectItem value="active">{t('statusActive')}</SelectItem>
              <SelectItem value="inactive">{t('statusInactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedModelIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/10 px-4 py-2">
            <span className="mr-1 text-xs font-medium tabular-nums">
              {t('selectedCount', { count: selectedModelIds.size })}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="relative w-28">
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={bulkMultiplierText}
                  onChange={(event) => setBulkMultiplierText(event.target.value)}
                  placeholder={t('bulkMultiplierPlaceholder')}
                  aria-label={t('bulkMultiplierPlaceholder')}
                  className="h-8 pr-7 text-right text-xs tabular-nums"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">×</span>
              </div>
              <Button type="button" size="sm" variant="outline" disabled={!canApplyBulkMultiplier || saving} onClick={applyBulkMultiplier}>
                <Gauge data-icon="inline-start" />
                {t('applyMultiplier')}
              </Button>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => applyBulkActive(true)}>
                <Power data-icon="inline-start" />
                {t('enableSelected')}
              </Button>
              <Button type="button" size="sm" variant="destructive" disabled={saving} onClick={() => applyBulkActive(false)}>
                <PowerOff data-icon="inline-start" />
                {t('disableSelected')}
              </Button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {selectedRows.length === 0 ? (
            <div className="grid h-full min-h-64 place-items-center text-sm text-muted-foreground">{t('noModels')}</div>
          ) : filteredRows.length === 0 ? (
            <div className="grid h-full min-h-64 place-items-center text-sm text-muted-foreground">{t('noSearchResults')}</div>
          ) : (
            <RadioGroup value={effectiveDefaultId} onValueChange={selectDefault} className="block">
              <Table className="min-w-[660px] table-fixed text-xs">
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 w-12 pr-0">
                      <Checkbox
                        checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                        onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                        aria-label={t('selectAllAria')}
                      />
                    </TableHead>
                    <TableHead className="h-10 w-[42%] min-w-64">{t('model')}</TableHead>
                    <TableHead className="h-10 w-40">{t('multiplier')}</TableHead>
                    <TableHead className="h-10 w-24 text-center">{t('isDefault')}</TableHead>
                    <TableHead className="h-10 w-24 text-center">{t('isActive')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const key = bindingDraftKey(row.taskType, row.modelConfigId);
                    const draft = drafts[key];
                    const active = draft?.isActive ?? row.isActive;
                    const invalid = invalidKeySet.has(key);
                    const isDirty = dirtyKeySet.has(key) || invalid;
                    const isEffectiveDefault = effectiveDefaultId === row.modelConfigId;
                    return (
                      <TableRow
                        key={row.modelConfigId}
                        data-state={selectedModelIds.has(row.modelConfigId) ? 'selected' : undefined}
                        className={cn('h-14', invalid && 'bg-destructive/5')}
                      >
                        <TableCell className="w-12 py-2.5 pr-0">
                          <Checkbox
                            checked={selectedModelIds.has(row.modelConfigId)}
                            onCheckedChange={(checked) => toggleModelSelection(row.modelConfigId, checked === true)}
                            aria-label={t('selectModelAria', { model: row.modelName || row.modelConfigId })}
                          />
                        </TableCell>
                        <TableCell className="relative py-2.5">
                          {isDirty && <span className="absolute left-0 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary" />}
                          <div className="truncate text-sm font-medium">{row.modelName || row.modelConfigId}</div>
                          <div className="truncate font-mono text-[11px] text-muted-foreground">{row.model || row.modelConfigId}</div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="relative w-28">
                            <Input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={draft?.multiplierText ?? formatMultiplier(row.multiplier)}
                              onChange={(event) => updateDraft(row, { multiplierText: event.target.value })}
                              aria-invalid={invalid}
                              aria-label={`${t('multiplier')} ${row.modelName || row.modelConfigId}`}
                              disabled={saving}
                              className="h-8 pr-7 text-right text-xs tabular-nums"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">×</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <RadioGroupItem
                                  value={row.modelConfigId}
                                  disabled={!active || saving}
                                  aria-label={t('setDefaultAria', { model: row.modelName || row.modelConfigId })}
                                  className="border border-border/70 bg-background"
                                />
                              </span>
                            </TooltipTrigger>
                            {!active && <TooltipContent>{t('enableBeforeDefault')}</TooltipContent>}
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Switch
                                  checked={active}
                                  disabled={isEffectiveDefault || saving}
                                  onCheckedChange={(checked) => updateDraft(row, { isActive: checked })}
                                  aria-label={t('toggleActiveAria', { model: row.modelName || row.modelConfigId })}
                                  className={cn(isEffectiveDefault && 'disabled:opacity-100')}
                                />
                              </span>
                            </TooltipTrigger>
                            {isEffectiveDefault && <TooltipContent>{t('defaultMustStayActive')}</TooltipContent>}
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </RadioGroup>
          )}
        </div>

        {(patches.length > 0 || invalidKeys.length > 0 || localError || error) && (
          <div className="flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">{t('unsavedCount', { count: patches.length })}</p>
              {(localError || error) && <p className="mt-0.5 truncate text-xs text-destructive">{localError || error}</p>}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setDrafts({});
                setDefaultDrafts({});
                setLocalError(null);
                onClearError?.();
              }}
            >
              <Undo2 data-icon="inline-start" />
              {t('discard')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || patches.length === 0 || invalidKeys.length > 0}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {saving ? t('saving') : t('saveChanges')}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!open && busyAdding) return;
          setAddDialogOpen(open);
          if (!open) onClearAddError?.();
        }}
      >
        <DialogContent
          showCloseButton={!busyAdding}
          className="!flex max-h-[min(720px,calc(100svh-2rem))] min-h-0 flex-col gap-4 overflow-hidden sm:max-w-2xl"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('addModelsTitle')}</DialogTitle>
            <DialogDescription>
              {t('addModelsDescription', { task: selectedSummary?.name ?? selectedTaskType })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <SearchInput
              value={addQuery}
              onChange={setAddQuery}
              placeholder={t('availableModelSearch')}
              disabled={busyAdding}
            />
            <label className="grid gap-1 text-xs text-muted-foreground">
              <span>{t('initialMultiplier')}</span>
              <div className="relative">
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={initialMultiplierText}
                  onChange={(event) => setInitialMultiplierText(event.target.value)}
                  disabled={busyAdding}
                  aria-invalid={Boolean(initialMultiplierText) && (!Number.isFinite(initialMultiplier) || initialMultiplier <= 0)}
                  className="h-8 pr-7 text-right text-xs tabular-nums"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">×</span>
              </div>
            </label>
          </div>

          <DialogBody className="min-h-0 flex-1 rounded-md border p-px">
            {modelsLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
              </div>
            ) : addableModels.length === 0 ? (
              <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-muted-foreground">
                {t('availableModelsEmpty')}
              </div>
            ) : (
              <div className="divide-y">
                {addableModels.map((model) => (
                  <label key={model.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                    <Checkbox
                      checked={addModelIds.has(model.id)}
                      onCheckedChange={(checked) => toggleAddModel(model.id, checked === true)}
                      disabled={busyAdding}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{model.name}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {model.provider} / {model.model}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </DialogBody>

          {addError && <p className="text-xs text-destructive">{addError}</p>}

          <DialogFooter className="shrink-0">
            <Button type="button" variant="ghost" disabled={busyAdding} onClick={() => setAddDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" disabled={!canAddModels || busyAdding} onClick={() => void handleAddModels()}>
              {busyAdding ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {busyAdding ? t('addingModels') : t('addSelectedModels', { count: addModelIds.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
