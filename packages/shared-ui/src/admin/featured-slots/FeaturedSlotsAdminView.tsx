'use client';

import { useMemo, useState } from 'react';
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

const DEFAULT_PLACEMENT = 'home_hero';

const CANDIDATE_RESOURCE_TYPES: { value: FeaturedSlotCandidateResourceType; label: string }[] = [
  { value: 'IMAGE_TEMPLATE', label: '图片模板' },
  { value: 'VIDEO_TEMPLATE', label: '视频模板' },
  { value: 'GALLERY_POST', label: '广场作品' },
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
    onError: (err) => setError(errorMessage(err, '操作失败')),
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
    if (!window.confirm(`确定要删除运营位《${label}》吗？`)) return;
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
          <h1 className="text-base font-semibold text-foreground">运营位编排</h1>
          <p className="text-xs text-muted-foreground">
            管理首页 Hero 展示位（{placement}），override 仅影响展示，不修改来源资源本身。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            新增运营位
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
            加载中…
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageOff />
              </EmptyMedia>
              <EmptyTitle>暂无运营位</EmptyTitle>
              <EmptyDescription>点击右上角“新增运营位”开始编排首页展示内容。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">顺序</TableHead>
                <TableHead>展示内容</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((slot, index) => {
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
                          // eslint-disable-next-line @next/next/no-img-element
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
                            {slot.overrideTitle || (slot.resourceId ? `资源 ${slot.resourceId}` : '未命名运营位')}
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
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          className="h-8 px-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(slot)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          删除
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

      <Dialog open={!!modal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{modal?.mode === 'create' ? '新增运营位' : '编辑运营位'}</DialogTitle></DialogHeader>
          {modal && (
            <DialogBody className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
              <div>
                <Label className="mb-1.5">类型</Label>
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
                    <SelectItem value="CUSTOM">CUSTOM（自定义内容）</SelectItem>
                    <SelectItem value="RESOURCE">RESOURCE（引用资源）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {modal.form.kind === 'RESOURCE' && (
                <div className="flex flex-col gap-2 rounded-md border p-3">
                  <Label className="mb-1">资源类型</Label>
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
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label className="mb-1 mt-2">搜索候选资源</Label>
                  <Input
                    value={candidateQuery}
                    onChange={(e) => setCandidateQuery(e.target.value)}
                    placeholder="按标题搜索"
                  />
                  <div className="max-h-40 overflow-y-auto rounded-md border">
                    {candidatesLoading ? (
                      <div className="p-3 text-xs text-muted-foreground">搜索中…</div>
                    ) : (candidates ?? []).length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">无匹配候选资源</div>
                    ) : (
                      (candidates ?? []).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted ${
                            modal.form.resourceId === c.id ? 'bg-muted' : ''
                          }`}
                          onClick={() =>
                            setModal({
                              ...modal,
                              form: { ...modal.form, resourceId: c.id, resourceTitle: c.title },
                            })
                          }
                        >
                          <span className="truncate">{c.title}</span>
                          {modal.form.resourceId === c.id && <Badge variant="secondary">已选</Badge>}
                        </button>
                      ))
                    )}
                  </div>
                  {modal.form.resourceId && (
                    <div className="text-xs text-muted-foreground">
                      已选资源 ID：{modal.form.resourceId}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">标题（覆盖）</Label>
                  <Input
                    value={modal.form.overrideTitle}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, overrideTitle: e.target.value } })
                    }
                    placeholder="展示标题"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">封面图片 URL</Label>
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
                  <Label className="mb-1.5">封面视频 URL</Label>
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
                  <Label className="mb-1.5">CTA 文案</Label>
                  <Input
                    value={modal.form.overrideCtaText}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, overrideCtaText: e.target.value } })
                    }
                    placeholder="立即体验"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="mb-1.5">CTA 跳转链接</Label>
                  <Input
                    value={modal.form.overrideCtaHref}
                    onChange={(e) =>
                      setModal({ ...modal, form: { ...modal.form, overrideCtaHref: e.target.value } })
                    }
                    placeholder="/templates/xxx"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="mb-1.5">描述（覆盖）</Label>
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
                <Label>启用该运营位</Label>
                <Switch
                  checked={modal.form.isEnabled}
                  onCheckedChange={(checked) =>
                    setModal({ ...modal, form: { ...modal.form, isEnabled: checked } })
                  }
                />
              </div>

              <p className="text-xs text-muted-foreground">
                提示：以上覆盖字段仅影响该运营位的展示内容，不会修改所引用的来源资源本身。
              </p>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={closeModal}>
              取消
            </Button>
            <Button
              className="cursor-pointer"
              disabled={saving || (modal?.form.kind === 'RESOURCE' && !modal.form.resourceId)}
              onClick={handleSave}
            >
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
