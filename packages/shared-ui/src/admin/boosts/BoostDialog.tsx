'use client';

import { useEffect, useState } from 'react';
import {
  useBoostAdmin,
  type BoostReason,
  type MetricResourceType,
} from '@autix/shared-store';
import { Button } from '../../ui/button';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '../../ui/dialog';

export const BOOST_RESOURCE_TYPE_OPTIONS: { value: MetricResourceType; label: string }[] = [
  { value: 'SKILL', label: '技能' },
  { value: 'MCP', label: 'MCP' },
  { value: 'AGENT', label: '智能体' },
  { value: 'IMAGE_TEMPLATE', label: '图片模板' },
  { value: 'VIDEO_TEMPLATE', label: '视频模板' },
  { value: 'GALLERY_POST', label: '广场作品' },
];

export const BOOST_REASON_OPTIONS: { value: BoostReason; label: string }[] = [
  { value: 'MANUAL', label: '人工加热' },
  { value: 'CAMPAIGN', label: '活动加热' },
  { value: 'EDITORIAL_PICK', label: '编辑精选' },
  { value: 'CORRECTION', label: '修正' },
];

/** 加热强度档位：小 / 中 / 大，对应 boostScore 数值。 */
export const BOOST_SCORE_TIERS: { value: string; label: string; score: number }[] = [
  { value: 'small', label: '小（+200）', score: 200 },
  { value: 'medium', label: '中（+500）', score: 500 },
  { value: 'large', label: '大（+1000）', score: 1000 },
];

type BoostDialogForm = {
  resourceType: MetricResourceType;
  resourceId: string;
  tier: string;
  reason: BoostReason;
  note: string;
  endsAt: string;
};

function emptyForm(resourceType: MetricResourceType, resourceId: string): BoostDialogForm {
  return {
    resourceType,
    resourceId,
    tier: 'medium',
    reason: 'MANUAL',
    note: '',
    endsAt: '',
  };
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function errorMessage(error: unknown, fallback: string): string {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } }).response
    ?.data?.message;
  if (typeof responseMessage === 'string') return responseMessage;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
}

export interface BoostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 预填并锁定资源类型/ID（如广场审核已审核 tab 内联加热）；缺省则表单内可自由选择/填写。 */
  resourceType?: MetricResourceType;
  resourceId?: string;
  /** 锁定资源时用于展示的说明文案，例如作品标题。 */
  resourceLabel?: string;
  title?: string;
  onSuccess?: () => void;
}

/**
 * 加热创建对话框：BoostAdminView（内容加热页）与广场审核已审核 tab（内联加热）共用，
 * 复用 useBoostAdmin 的 create mutation，不重复加热逻辑（见 P8 任务说明）。
 */
export function BoostDialog({
  open,
  onOpenChange,
  resourceType: lockedResourceType,
  resourceId: lockedResourceId,
  resourceLabel,
  title = '新增加热',
  onSuccess,
}: BoostDialogProps) {
  const locked = lockedResourceType !== undefined && lockedResourceId !== undefined;
  const [form, setForm] = useState<BoostDialogForm>(
    emptyForm(lockedResourceType ?? 'IMAGE_TEMPLATE', lockedResourceId ?? ''),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(emptyForm(lockedResourceType ?? 'IMAGE_TEMPLATE', lockedResourceId ?? ''));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lockedResourceType, lockedResourceId]);

  const { create } = useBoostAdmin({
    onSuccess: () => {
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => setError(errorMessage(err, '操作失败')),
  });

  const handleCreate = () => {
    if (!form.resourceId.trim() || !form.endsAt) return;
    const tier = BOOST_SCORE_TIERS.find((t) => t.value === form.tier) ?? BOOST_SCORE_TIERS[1];
    create.mutate({
      resourceType: form.resourceType,
      resourceId: form.resourceId.trim(),
      data: {
        boostScore: tier.score,
        reason: form.reason,
        note: form.note.trim() || null,
        endsAt: fromLocalInput(form.endsAt) ?? new Date().toISOString(),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {locked ? (
              <div className="col-span-2">
                <Label className="mb-1.5">目标资源</Label>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {resourceLabel ?? `${lockedResourceType} ${lockedResourceId}`}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label className="mb-1.5">资源类型</Label>
                  <Select
                    value={form.resourceType}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, resourceType: value as MetricResourceType }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOOST_RESOURCE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5">资源 ID</Label>
                  <Input
                    value={form.resourceId}
                    onChange={(e) => setForm((f) => ({ ...f, resourceId: e.target.value }))}
                    placeholder="目标资源 ID"
                  />
                </div>
              </>
            )}
            <div>
              <Label className="mb-1.5">加热强度</Label>
              <Select
                value={form.tier}
                onValueChange={(value) => setForm((f) => ({ ...f, tier: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOST_SCORE_TIERS.map((tier) => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">原因</Label>
              <Select
                value={form.reason}
                onValueChange={(value) => setForm((f) => ({ ...f, reason: value as BoostReason }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOST_REASON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="mb-1.5">结束时间</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label className="mb-1.5">备注</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="min-h-[70px]"
                placeholder="加热原因说明，仅后台可见"
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            className="cursor-pointer"
            disabled={create.isPending || !form.resourceId.trim() || !form.endsAt}
            onClick={handleCreate}
          >
            {create.isPending ? '保存中…' : '确认加热'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
