'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { getAvailableModels, createModel, isVideoModel, type ModelConfigItem } from '@autix/shared-lib';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface VideoModelSelectorProps {
  /** 当前选中的 modelConfigId（UUID）。空字符串表示走后端默认。 */
  value: string;
  /** 选中模型 id 时回调；id 为空字符串代表清空（走默认）。 */
  onChange: (modelConfigId: string) => void;
  disabled?: boolean;
  models?: ModelConfigItem[];
  loading?: boolean;
  onModelCreated?: (model: ModelConfigItem) => void;
}

const AMUX_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL_VALUE = '__default__';

export function VideoModelSelector({
  value,
  onChange,
  disabled,
  models,
  loading = false,
  onModelCreated,
}: VideoModelSelectorProps) {
  const [localModels, setLocalModels] = useState<ModelConfigItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const resolvedModels = models ?? localModels;
  const controlledModels = models !== undefined;

  useEffect(() => {
    if (controlledModels) return;
    getAvailableModels().then((res) => {
      const videoModels = (res.data ?? []).filter(isVideoModel);
      setLocalModels(videoModels);
    });
  }, [controlledModels]);

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">模型</span>
      <Select
        value={value || DEFAULT_MODEL_VALUE}
        onValueChange={(nextValue) => {
          if (nextValue === '__add__') {
            setDialogOpen(true);
          } else if (nextValue === DEFAULT_MODEL_VALUE) {
            onChange('');
          } else {
            onChange(nextValue);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 min-w-[132px] border-border bg-background px-2.5 text-xs shadow-none">
          <SelectValue placeholder="默认" />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[70] rounded-lg">
          <SelectItem value={DEFAULT_MODEL_VALUE} className="text-xs">默认</SelectItem>
          {loading && resolvedModels.length === 0 && (
            <SelectItem value="__loading__" disabled className="text-xs">加载模型中...</SelectItem>
          )}
          {resolvedModels.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              {m.name}
            </SelectItem>
          ))}
          <SelectItem value="__add__" className="text-xs">+ 添加模型</SelectItem>
        </SelectContent>
      </Select>

      <AddVideoModelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(model) => {
          if (controlledModels) {
            onModelCreated?.(model);
          } else {
            setLocalModels((prev) => [...prev, model]);
          }
          onChange(model.id);
        }}
      />
    </label>
  );
}

function AddVideoModelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (model: ModelConfigItem) => void;
}) {
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !modelId || !apiKey) return;
    setSaving(true);
    try {
      const res = await createModel({
        name,
        model: modelId,
        provider: 'amux',
        type: 'video',
        baseUrl: AMUX_BASE_URL,
        apiKey,
        priority: 0,
        isDefault: false,
        capabilities: ['video'],
        visibility: 'public',
      });
      onCreated(res.data as ModelConfigItem);
      onOpenChange(false);
      setName('');
      setModelId('');
      setApiKey('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>添加视频模型</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>渠道</Label>
            <Input value="Amux (火山方舟)" disabled />
          </div>

          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input value={AMUX_BASE_URL} disabled />
          </div>

          <div className="space-y-2">
            <Label>名称</Label>
            <Input
              placeholder="例如: 视频生成 Pro"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Model ID</Label>
            <Input
              placeholder="例如: doubao-video-model-id"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              placeholder="您的 API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={handleSave} disabled={!name || !modelId || !apiKey || saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
