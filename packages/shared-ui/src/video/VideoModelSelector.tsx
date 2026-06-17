'use client';

import { useState, useEffect } from 'react';
import { getAvailableModels, isVideoModel, type ModelConfigItem } from '@autix/shared-lib';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface VideoModelSelectorProps {
  /** 当前选中的 modelConfigId（UUID）。空字符串表示走后端默认。 */
  value: string;
  /** 选中模型 id 时回调；id 为空字符串代表清空（走默认）。 */
  onChange: (modelConfigId: string) => void;
  disabled?: boolean;
  models?: ModelConfigItem[];
  loading?: boolean;
}

const DEFAULT_MODEL_VALUE = '__default__';

export function VideoModelSelector({
  value,
  onChange,
  disabled,
  models,
  loading = false,
}: VideoModelSelectorProps) {
  const [localModels, setLocalModels] = useState<ModelConfigItem[]>([]);
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
          if (nextValue === DEFAULT_MODEL_VALUE) {
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
          {!loading && resolvedModels.length === 0 && (
            <SelectItem value="__empty__" disabled className="text-xs">
              暂无视频模型，请联系系统管理员配置
            </SelectItem>
          )}
          {resolvedModels.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
