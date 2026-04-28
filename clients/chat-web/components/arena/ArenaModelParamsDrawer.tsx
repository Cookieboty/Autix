'use client';

import { useCallback, useMemo } from 'react';
import { Settings, RotateCcw } from 'lucide-react';
import { Button } from '@heroui/react';
import {
  DrawerShell,
  DrawerHero,
  DrawerBody,
  DrawerSection,
  DrawerFooterRow,
} from '@/components/drawer-shell';
import { useArenaStore } from '@/store/arena.store';
import {
  type ModelParamsConfig,
  type ModelParams,
  CHAT_PARAM_DEFS,
  IMAGE_SELECT_DEFS,
  IMAGE_N_DEF,
  getDefaultChatParams,
  getDefaultImageParams,
  hasChatCapability,
  hasImageCapability,
} from '@/lib/model-params';

interface ArenaModelParamsDrawerProps {
  modelId: string | null;
  modelName: string;
  capabilities: string[];
  onClose: () => void;
}

function ParamSliderRow({
  label,
  value,
  min,
  max,
  step,
  enabled,
  onToggle,
  onChange,
  isInteger,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  enabled: boolean;
  onToggle: () => void;
  onChange: (v: number) => void;
  isInteger?: boolean;
}) {
  return (
    <div
      className="space-y-2 rounded-lg px-3 py-2.5"
      style={{
        backgroundColor: enabled ? 'transparent' : 'var(--panel-muted)',
        opacity: enabled ? 1 : 0.5,
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
          {label}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={isInteger ? Math.round(value) : value}
            min={min}
            max={max}
            step={step}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="w-20 rounded-md px-2 py-1 text-xs text-right outline-none"
            style={{
              backgroundColor: 'var(--surface)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            }}
          />
          <button
            onClick={onToggle}
            className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors"
            style={{
              backgroundColor: enabled ? 'var(--accent)' : 'var(--surface-tertiary)',
              border: '1px solid var(--border)',
            }}
          >
            <span
              className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
              style={{
                backgroundColor: '#fff',
                transform: enabled ? 'translateX(16px)' : 'translateX(2px)',
                marginTop: '2px',
              }}
            />
          </button>
        </div>
      </div>
      {enabled && max - min <= 10 && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full accent-[var(--accent)]"
          style={{ height: '4px' }}
        />
      )}
    </div>
  );
}

function ParamSelectRow({
  label,
  value,
  options,
  enabled,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  enabled: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2.5"
      style={{
        backgroundColor: enabled ? 'transparent' : 'var(--panel-muted)',
        opacity: enabled ? 1 : 0.5,
        border: '1px solid var(--border)',
      }}
    >
      <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <select
          value={value}
          disabled={!enabled}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md px-2 py-1 text-xs outline-none cursor-pointer"
          style={{
            backgroundColor: 'var(--surface)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={onToggle}
          className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors"
          style={{
            backgroundColor: enabled ? 'var(--accent)' : 'var(--surface-tertiary)',
            border: '1px solid var(--border)',
          }}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
            style={{
              backgroundColor: '#fff',
              transform: enabled ? 'translateX(16px)' : 'translateX(2px)',
              marginTop: '2px',
            }}
          />
        </button>
      </div>
    </div>
  );
}

export function ArenaModelParamsDrawer({
  modelId,
  modelName,
  capabilities,
  onClose,
}: ArenaModelParamsDrawerProps) {
  const { modelParamsMap, setModelParams, resetModelParams } = useArenaStore();

  const showChat = hasChatCapability(capabilities);
  const showImage = hasImageCapability(capabilities);

  const config = useMemo<ModelParamsConfig>(() => {
    if (modelId && modelParamsMap[modelId]) {
      return modelParamsMap[modelId];
    }
    if (showImage && !showChat) return getDefaultImageParams();
    if (showImage && showChat) {
      const chat = getDefaultChatParams();
      const img = getDefaultImageParams();
      return {
        params: { ...chat.params, ...img.params },
        enabled: { ...chat.enabled, ...img.enabled },
      };
    }
    return getDefaultChatParams();
  }, [modelId, modelParamsMap, showChat, showImage]);

  const updateParam = useCallback(
    (key: string, value: number | string) => {
      if (!modelId) return;
      const current = modelParamsMap[modelId] ?? config;
      setModelParams(modelId, {
        params: { ...current.params, [key]: value },
        enabled: { ...current.enabled },
      });
    },
    [modelId, modelParamsMap, config, setModelParams],
  );

  const toggleEnabled = useCallback(
    (key: string) => {
      if (!modelId) return;
      const current = modelParamsMap[modelId] ?? config;
      setModelParams(modelId, {
        params: { ...current.params },
        enabled: { ...current.enabled, [key]: !current.enabled[key] },
      });
    },
    [modelId, modelParamsMap, config, setModelParams],
  );

  const handleReset = useCallback(() => {
    if (modelId) resetModelParams(modelId);
  }, [modelId, resetModelParams]);

  return (
    <DrawerShell
      open={!!modelId}
      onClose={onClose}
      width="sm"
      header={
        <DrawerHero
          icon={<Settings className="h-4 w-4" />}
          eyebrow="模型参数"
          title={modelName || '参数配置'}
          description="调整模型参数以控制生成行为"
        />
      }
      footer={
        <DrawerFooterRow
          aside={
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              仅启用的参数会发送给模型
            </span>
          }
          actions={
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-xs cursor-pointer"
              style={{ color: 'var(--muted)' }}
              onPress={handleReset}
            >
              <RotateCcw className="h-3 w-3" />
              重置默认
            </Button>
          }
        />
      }
    >
      <DrawerBody>
        {showChat && (
          <DrawerSection
            title="对话参数 Chat"
            description="控制文本生成的随机性和长度"
          >
            <div className="space-y-2">
              {CHAT_PARAM_DEFS.map((def) => (
                <ParamSliderRow
                  key={def.key}
                  label={def.label}
                  value={
                    (config.params as any)[def.key] ?? def.defaultValue
                  }
                  min={def.min}
                  max={def.max}
                  step={def.step}
                  enabled={config.enabled[def.key] ?? false}
                  onToggle={() => toggleEnabled(def.key)}
                  onChange={(v) => updateParam(def.key, v)}
                  isInteger={def.key === 'maxTokens'}
                />
              ))}
            </div>
          </DrawerSection>
        )}

        {showImage && (
          <DrawerSection
            title="图片参数 Image"
            description="控制图片生成的尺寸、质量和风格"
          >
            <div className="space-y-2">
              {IMAGE_SELECT_DEFS.map((def) => (
                <ParamSelectRow
                  key={def.key}
                  label={def.label}
                  value={
                    ((config.params as any)[def.key] as string) ??
                    def.defaultValue
                  }
                  options={def.options}
                  enabled={config.enabled[def.key] ?? true}
                  onToggle={() => toggleEnabled(def.key)}
                  onChange={(v) => updateParam(def.key, v)}
                />
              ))}
              <ParamSliderRow
                label={IMAGE_N_DEF.label}
                value={
                  (config.params as any)[IMAGE_N_DEF.key] ??
                  IMAGE_N_DEF.defaultValue
                }
                min={IMAGE_N_DEF.min}
                max={IMAGE_N_DEF.max}
                step={IMAGE_N_DEF.step}
                enabled={config.enabled[IMAGE_N_DEF.key] ?? true}
                onToggle={() => toggleEnabled(IMAGE_N_DEF.key)}
                onChange={(v) => updateParam(IMAGE_N_DEF.key, v)}
                isInteger
              />
            </div>
          </DrawerSection>
        )}

        {!showChat && !showImage && (
          <div
            className="py-8 text-center text-sm"
            style={{ color: 'var(--muted)' }}
          >
            此模型暂无可配置参数
          </div>
        )}
      </DrawerBody>
    </DrawerShell>
  );
}
