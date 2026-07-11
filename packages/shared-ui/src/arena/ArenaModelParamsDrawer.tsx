'use client';

import { useCallback, useMemo } from 'react';
import { Settings, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useTranslations } from 'next-intl';
import {
  DrawerShell,
  DrawerHero,
  DrawerBody,
  DrawerSection,
  DrawerFooterRow,
} from '../drawer-shell';
import { useArenaStore } from '@autix/shared-store';
import {
  type ModelParamsConfig,
  CHAT_PARAM_DEFS,
  getDefaultChatParams,
  getDefaultImageParams,
  hasChatCapability,
  hasImageCapability,
} from '@autix/shared-store';
import {
  buildImageSizeView,
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
  type ImageModelHint,
} from '@autix/domain/image';

interface ArenaModelParamsDrawerProps {
  modelId: string | null;
  modelName: string;
  capabilities: string[];
  imageModelHint?: ImageModelHint | null;
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
      className={`space-y-2 rounded-lg px-3 py-2.5 border border-border ${
        enabled ? 'bg-transparent' : 'bg-secondary opacity-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">
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
            className="w-20 rounded-md px-2 py-1 text-xs text-right outline-none bg-card text-foreground border border-border"
          />
          <button
            onClick={onToggle}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors border border-border ${
              enabled ? 'bg-primary' : 'bg-accent'
            }`}
          >
            <span
              className="mt-[2px] inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
              style={{
                transform: enabled ? 'translateX(16px)' : 'translateX(2px)',
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
          className="w-full h-1 accent-primary"
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
      className={`flex items-center justify-between rounded-lg px-3 py-2.5 border border-border ${
        enabled ? 'bg-transparent' : 'bg-secondary opacity-50'
      }`}
    >
      <label className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onChange} disabled={!enabled}>
          <SelectTrigger size="sm" className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors border border-border ${
            enabled ? 'bg-primary' : 'bg-accent'
          }`}
        >
          <span
            className="mt-[2px] inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
            style={{
              transform: enabled ? 'translateX(16px)' : 'translateX(2px)',
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
  imageModelHint,
  onClose,
}: ArenaModelParamsDrawerProps) {
  const t = useTranslations('arenaParams');
  const tImage = useTranslations('chat.imageParams');
  // 画质档位显示名走 i18n(pricing.options.<value>)；capability.qualities 只存 value token。
  const tOptions = useTranslations('pricing.options');
  const { modelParamsMap, setModelParams, resetModelParams } = useArenaStore();

  const showChat = hasChatCapability(capabilities);
  const showImage = hasImageCapability(capabilities);

  // 图片参数按所选模型的能力表渲染（与聊天/工作台共用同一套规则），
  // 不再写死 gpt-image 的尺寸/质量。
  const imageCapability =
    IMAGE_MODEL_CAPABILITIES[detectImageModelKind(imageModelHint ?? null)];

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
          eyebrow={t('eyebrow')}
          title={modelName || t('title')}
          description={t('description')}
        />
      }
      footer={
        <DrawerFooterRow
          aside={
            <span className="text-[11px] text-muted-foreground">
              {t('enabledNote')}
            </span>
          }
          actions={
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-xs cursor-pointer text-muted-foreground"
              onClick={handleReset}
            >
              <RotateCcw className="h-3 w-3" />
              {t('resetDefault')}
            </Button>
          }
        />
      }
    >
      <DrawerBody>
        {showChat && (
          <DrawerSection
            title={t('chatParams')}
            description={t('chatParamsDesc')}
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

        {showImage && (() => {
          const sizeValue =
            ((config.params.size as string | undefined) ?? imageCapability.defaults.size);
          const sizeView = buildImageSizeView(imageCapability, sizeValue);
          const sizeEnabled = config.enabled['size'] ?? true;
          return (
            <DrawerSection
              title={t('imageParams')}
              description={t('imageParamsDesc')}
            >
              <div className="space-y-2">
                <div
                  className={`space-y-2 rounded-lg px-3 py-2.5 border border-border ${
                    sizeEnabled ? 'bg-transparent' : 'bg-secondary opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      {tImage('size')}
                    </label>
                    <button
                      onClick={() => toggleEnabled('size')}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors border border-border ${
                        sizeEnabled ? 'bg-primary' : 'bg-accent'
                      }`}
                    >
                      <span
                        className="mt-[2px] inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                        style={{ transform: sizeEnabled ? 'translateX(16px)' : 'translateX(2px)' }}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {sizeView.hasResolutionTiers && (
                      <Select
                        value={sizeView.selectedTier?.value ?? ''}
                        onValueChange={(v) => updateParam('size', sizeView.pickResolution(v))}
                        disabled={!sizeEnabled}
                      >
                        <SelectTrigger size="sm" className="flex-1 text-xs">
                          <SelectValue placeholder={tImage('resolution')} />
                        </SelectTrigger>
                        <SelectContent>
                          {sizeView.groups.map((group) => (
                            <SelectItem key={group.value} value={group.value}>
                              {group.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Select
                      value={sizeView.selectedAspect?.aspectValue ?? ''}
                      onValueChange={(v) => updateParam('size', sizeView.pickAspect(v))}
                      disabled={!sizeEnabled}
                    >
                      <SelectTrigger size="sm" className="flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sizeView.aspectOptions.map((option) => (
                          <SelectItem key={option.aspectValue} value={option.aspectValue}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {imageCapability.qualities.length > 0 && (
                  <ParamSelectRow
                    label={tImage('quality')}
                    value={
                      (config.params.quality as string | undefined) ??
                      imageCapability.defaults.quality
                    }
                    options={imageCapability.qualities.map((value) => ({
                      value,
                      label: tOptions.has(value) ? tOptions(value) : value,
                    }))}
                    enabled={config.enabled['quality'] ?? true}
                    onToggle={() => toggleEnabled('quality')}
                    onChange={(v) => updateParam('quality', v)}
                  />
                )}
              </div>
            </DrawerSection>
          );
        })()}

        {!showChat && !showImage && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('noParams')}
          </div>
        )}
      </DrawerBody>
    </DrawerShell>
  );
}
