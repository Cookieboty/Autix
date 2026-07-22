'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  ImageOff,
  Plus,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  useFeaturedSlotCandidates,
  useFeaturedSlotsAdmin,
  useFeaturedSlotsList,
  type CreateFeaturedSlotInput,
  type FeaturedSlot,
  type FeaturedSlotCandidateResourceType,
  type FeaturedSlotKind,
  type MetricResourceType,
} from '@autix/shared-store';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '../../ui/dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '../../ui/empty';
import { AdminPaginationFooter, useClientPagination } from '../layout';

const DEFAULT_PLACEMENT = 'home_hero';

const CANDIDATE_RESOURCE_TYPES: { value: FeaturedSlotCandidateResourceType; labelKey: string }[] = [
  { value: 'IMAGE_TEMPLATE', labelKey: 'resourceTypes.IMAGE_TEMPLATE' },
  { value: 'VIDEO_TEMPLATE', labelKey: 'resourceTypes.VIDEO_TEMPLATE' },
  { value: 'GALLERY_POST', labelKey: 'resourceTypes.GALLERY_POST' },
];

type SlotForm = {
  kind: FeaturedSlotKind;
  resourceType: FeaturedSlotCandidateResourceType;
  resourceId: string;
  resourceTitle: string;
  overrideTitle: string;
  overrideDescription: string;
  overrideCoverImage: string;
  overrideCoverVideo: string;
  overrideCtaText: string;
  overrideCtaHref: string;
  isEnabled: boolean;
};

const EMPTY_FORM: SlotForm = {
  kind: 'CUSTOM',
  resourceType: 'IMAGE_TEMPLATE',
  resourceId: '',
  resourceTitle: '',
  overrideTitle: '',
  overrideDescription: '',
  overrideCoverImage: '',
  overrideCoverVideo: '',
  overrideCtaText: '',
  overrideCtaHref: '',
  isEnabled: true,
};

function formFromSlot(slot: FeaturedSlot): SlotForm {
  return {
    kind: slot.kind,
    resourceType:
      (slot.resourceType as FeaturedSlotCandidateResourceType | null) ?? 'IMAGE_TEMPLATE',
    resourceId: slot.resourceId ?? '',
    resourceTitle: '',
    overrideTitle: slot.overrideTitle ?? '',
    overrideDescription: slot.overrideDescription ?? '',
    overrideCoverImage: slot.overrideCoverImage ?? '',
    overrideCoverVideo: slot.overrideCoverVideo ?? '',
    overrideCtaText: slot.overrideCtaText ?? '',
    overrideCtaHref: slot.overrideCtaHref ?? '',
    isEnabled: slot.isEnabled,
  };
}

function payloadFromForm(form: SlotForm): Omit<CreateFeaturedSlotInput, 'placement'> {
  return {
    kind: form.kind,
    resourceType: form.kind === 'RESOURCE' ? (form.resourceType as MetricResourceType) : null,
    resourceId: form.kind === 'RESOURCE' ? form.resourceId || null : null,
    overrideTitle: form.overrideTitle.trim() || null,
    overrideDescription: form.overrideDescription.trim() || null,
    overrideCoverImage: form.overrideCoverImage.trim() || null,
    overrideCoverVideo: form.overrideCoverVideo.trim() || null,
    overrideCtaText: form.overrideCtaText.trim() || null,
    overrideCtaHref: form.overrideCtaHref.trim() || null,
    isEnabled: form.isEnabled,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } }).response
    ?.data?.message;
  if (typeof responseMessage === 'string') return responseMessage;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
}

export interface FeaturedSlotsAdminViewProps {
  placement?: string;
}

export function FeaturedSlotsAdminView({
  placement = DEFAULT_PLACEMENT,
}: FeaturedSlotsAdminViewProps) {
  const t = useTranslations('adminOperations');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: SlotForm } | null>(
    null,
  );
  const [candidateQuery, setCandidateQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: slots, isLoading, isFetching, refetch } = useFeaturedSlotsList(placement);
  const { create, update, remove, reorder } = useFeaturedSlotsAdmin(placement, {
    onSuccess: () => {
      setModal(null);
      setError(null);
    },
    onError: (err) => setError(errorMessage(err, t('common.operationFailed'))),
  });

  const { data: candidates, isFetching: candidatesLoading } = useFeaturedSlotCandidates(
    modal?.form.resourceType ?? 'IMAGE_TEMPLATE',
    candidateQuery,
    Boolean(modal && modal.form.kind === 'RESOURCE'),
  );

  const items = useMemo(
    () => [...(slots ?? [])].sort((a, b) => a.position - b.position),
    [slots],
  );
  const {
    items: pagedItems,
    page,
    setPage,
    pageSize,
    total,
  } = useClientPagination(items, 20);
  const loading = isLoading || isFetching;
  const saving = create.isPending || update.isPending;

  const openCreate = () => {
    setError(null);
    setCandidateQuery('');
    setModal({ mode: 'create', form: { ...EMPTY_FORM } });
  };

  const openEdit = (slot: FeaturedSlot) => {
    setError(null);
    setCandidateQuery('');
    setModal({ mode: 'edit', id: slot.id, form: formFromSlot(slot) });
  };

  const closeModal = () => setModal(null);

  const handleSave = () => {
    if (!modal) return;
    const payload = payloadFromForm(modal.form);
    if (modal.mode === 'create') {
      create.mutate({ placement, ...payload });
    } else if (modal.id) {
      update.mutate({ id: modal.id, data: payload });
    }
  };

  const handleToggleEnabled = (slot: FeaturedSlot) => {
    update.mutate({ id: slot.id, data: { isEnabled: !slot.isEnabled } });
  };

  const handleDelete = (slot: FeaturedSlot) => {
    const label = slot.overrideTitle ?? slot.resourceId ?? slot.id;
    if (!window.confirm(t('featured.deleteConfirm', { label }))) return;
    remove.mutate(slot.id);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const orderedIds = items.map((item) => item.id);
    const tmp = orderedIds[index];
    orderedIds[index] = orderedIds[target];
    orderedIds[target] = tmp;
    reorder.mutate(orderedIds);
  };

  const thumbnailOf = (slot: FeaturedSlot): string | null => slot.overrideCoverImage;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t('featured.title')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('featured.description', { placement })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('common.refresh')}
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            {t('featured.add')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-lg border bg-surface">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageOff />
              </EmptyMedia>
              <EmptyTitle>{t('featured.emptyTitle')}</EmptyTitle>
              <EmptyDescription>{t('featured.emptyDescription')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">{t('featured.columns.order')}</TableHead>
                <TableHead>{t('featured.columns.content')}</TableHead>
                <TableHead>{t('featured.columns.type')}</TableHead>
                <TableHead>{t('featured.columns.enabled')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedItems.map((slot) => {
                const index = items.findIndex((entry) => entry.id === slot.id);
                const thumb = thumbnailOf(slot);
                return (
                  <TableRow key={slot.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 cursor-pointer p-0"
                          disabled={index === 0 || reorder.isPending}
                          onClick={() => handleMove(index, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 cursor-pointer p-0"
                          disabled={index === items.length - 1 || reorder.isPending}
                          onClick={() => handleMove(index, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={slot.overrideTitle ?? ''}
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                            <ImageOff className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {slot.overrideTitle || (slot.resourceId ? t('featured.resourceFallback', { id: slot.resourceId }) : t('featured.untitled'))}
                          </div>
                          {slot.kind === 'RESOURCE' && (
                            <div className="truncate text-xs text-muted-foreground">
                              {slot.resourceType} · {slot.resourceId}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {slot.kind === 'RESOURCE' ? 'RESOURCE' : 'CUSTOM'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={slot.isEnabled}
                        disabled={update.isPending}
                        onCheckedChange={() => handleToggleEnabled(slot)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 cursor-pointer"
                          onClick={() => openEdit(slot)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          {t('common.edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          className="h-8 px-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(slot)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {t('common.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AdminPaginationFooter page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Dialog open={!!modal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{modal?.mode === 'create' ? t('featured.add') : t('featured.edit')}</DialogTitle></DialogHeader>
          {modal && (
            <DialogBody className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
              <div>
                <Label className="mb-1.5">{t('featured.form.type')}</Label>
                <Select
                  value={modal.form.kind}
                  onValueChange={(value) =>
                    setModal({ ...modal, form: { ...modal.form, kind: value as FeaturedSlotKind } })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOM">{t('featured.kind.custom')}</SelectItem>
                    <SelectItem value="RESOURCE">{t('featured.kind.resource')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {modal.form.kind === 'RESOURCE' && (
                <div className="flex flex-col gap-2 rounded-md border p-3">
                  <Label className="mb-1">{t('featured.form.resourceType')}</Label>
                  <Select
                    value={modal.form.resourceType}
                    onValueChange={(value) =>
                      setModal({
                        ...modal,
                        form: {
                          ...modal.form,
                          resourceType: value as FeaturedSlotCandidateResourceType,
                          resourceId: '',
                          resourceTitle: '',
                        },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CANDIDATE_RESOURCE_TYPES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label className="mb-1 mt-2">{t('featured.form.searchCandidates')}</Label>
                  <Input
                    value={candidateQuery}
                    onChange={(e) => setCandidateQuery(e.target.value)}
                    placeholder={t('featured.form.searchPlaceholder')}
                  />
                  <div className="max-h-40 overflow-y-auto rounded-md border">
                    {candidatesLoading ? (
                      <div className="p-3 text-xs text-muted-foreground">{t('featured.searching')}</div>
                    ) : (candidates ?? []).length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">{t('featured.noCandidates')}</div>
                    ) : (
                      (candidates ?? []).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted ${modal.form.resourceId === c.id ? 'bg-muted' : ''
                            }`}
                          onClick={() =>
                            setModal({
                              ...modal,
                              form: { ...modal.form, resourceId: c.id, resourceTitle: c.title },
                            })
                          }
                        >
                          <span className="truncate">{c.title}</span>
                          {modal.form.resourceId === c.id && <Badge variant="secondary">{t('featured.selected')}</Badge>}
                        </button>
                      ))
                    )}
                  </div>
                  {modal.form.resourceId && (
                    <div className="text-xs text-muted-foreground">
                      {t('featured.selectedResourceId', { id: modal.form.resourceId })}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">{t('featured.form.overrideTitle')}</Label>
                  <Input
                    value={modal.form.overrideTitle}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, overrideTitle: e.target.value } })
                    }
                    placeholder={t('featured.form.titlePlaceholder')}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">{t('featured.form.coverImage')}</Label>
                  <Input
                    value={modal.form.overrideCoverImage}
                    onChange={(e) =>
                      setModal({
                        ...modal,
                        form: { ...modal.form, overrideCoverImage: e.target.value },
                      })
                    }
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label className="mb-1.5">{t('featured.form.coverVideo')}</Label>
                  <Input
                    value={modal.form.overrideCoverVideo}
                    onChange={(e) =>
                      setModal({
                        ...modal,
                        form: { ...modal.form, overrideCoverVideo: e.target.value },
                      })
                    }
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label className="mb-1.5">{t('featured.form.ctaText')}</Label>
                  <Input
                    value={modal.form.overrideCtaText}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, overrideCtaText: e.target.value } })
                    }
                    placeholder={t('featured.form.ctaPlaceholder')}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="mb-1.5">{t('featured.form.ctaHref')}</Label>
                  <Input
                    value={modal.form.overrideCtaHref}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, overrideCtaHref: e.target.value } })
                    }
                    placeholder="/templates/xxx"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="mb-1.5">{t('featured.form.overrideDescription')}</Label>
                  <Textarea
                    value={modal.form.overrideDescription}
                    onChange={(e) =>
                      setModal({
                        ...modal,
                        form: { ...modal.form, overrideDescription: e.target.value },
                      })
                    }
                    className="min-h-[70px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>{t('featured.form.enableSlot')}</Label>
                <Switch
                  checked={modal.form.isEnabled}
                  onCheckedChange={(checked) =>
                    setModal({ ...modal, form: { ...modal.form, isEnabled: checked } })
                  }
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {t('featured.form.hint')}
              </p>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button
              className="cursor-pointer"
              disabled={saving || (modal?.form.kind === 'RESOURCE' && !modal.form.resourceId)}
              onClick={handleSave}
            >
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
