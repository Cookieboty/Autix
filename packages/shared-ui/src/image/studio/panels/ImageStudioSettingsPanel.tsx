'use client';

import { Crop, Images, SlidersHorizontal, Wand2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  buildImageSizeResolutionGroups,
  resolveImageSizeSelection,
  selectImageSizeResolution,
  type ImageModelCapability,
} from '@autix/domain/image';
import {
  STYLE_PRESET_VALUES,
  type ImageStudioModelSettings,
} from '../constants';
import {
  ChipButton,
  PanelLabel,
  SliderRow,
} from '../shared/PrimitiveControls';
import { SelectLike } from '../shared/SelectLike';
import { cn } from '../../../ui/utils';

export function ImageStudioSettingsPanel({
  open,
  provider,
  capability,
  settings,
  onClose,
  onSettingsChange,
}: {
  open: boolean;
  provider: string;
  capability: ImageModelCapability;
  settings: ImageStudioModelSettings;
  onClose: () => void;
  onSettingsChange: (partial: Partial<ImageStudioModelSettings>) => void;
}) {
  const t = useTranslations('imageStudio');
  const tStyle = useTranslations('imageStudio.stylePresets');
  const sizeGroups = buildImageSizeResolutionGroups(capability);
  const selectedSize = resolveImageSizeSelection(settings.size, sizeGroups);
  const selectedGroup = selectedSize.group;
  const aspectOptions = selectedGroup?.options ?? [];

  return (
    <aside
      className={cn(
        'h-full w-[300px] shrink-0 flex-col border-r border-border bg-muted/18',
        open
          ? 'fixed inset-y-0 left-0 z-40 flex bg-background shadow-xl'
          : 'hidden',
        'lg:static lg:z-auto lg:flex lg:bg-muted/18 lg:shadow-none',
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wand2 className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{t('panel.title')}</h2>
            <p className="truncate text-xs text-muted-foreground">{t('panel.subtitle', { provider })}</p>
          </div>
          <button
            type="button"
            aria-label={t('panel.close')}
            className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-5">
          {sizeGroups.length > 1 && (
            <section className="space-y-2">
              <PanelLabel icon={<Images className="size-3.5" />} label={t('panel.resolution.label')} />
              <div className={cn('grid gap-2', sizeGroups.length <= 4 ? 'grid-cols-4' : 'grid-cols-2')}>
                {sizeGroups.map((group) => (
                  <ChipButton
                    key={group.value}
                    active={selectedGroup?.value === group.value}
                    onClick={() =>
                      onSettingsChange({
                        size: selectImageSizeResolution(settings.size, group.value, sizeGroups),
                      })
                    }
                  >
                    {group.label}
                  </ChipButton>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <PanelLabel icon={<Crop className="size-3.5" />} label={t('panel.aspectRatio.label')} />
            <div className={cn('grid gap-2', aspectOptions.length <= 2 ? 'grid-cols-2' : 'grid-cols-3')}>
              {aspectOptions.map((opt) => (
                <ChipButton
                  key={opt.value}
                  active={selectedSize.option?.value === opt.value}
                  onClick={() => onSettingsChange({ size: opt.value })}
                >
                  {opt.label}
                </ChipButton>
              ))}
            </div>
          </section>

          {capability.qualities.length > 0 && (
            <section className="space-y-2">
              <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label={t('panel.quality.label')} />
              <div className={cn('grid gap-2', capability.qualities.length <= 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                {capability.qualities.map((opt) => (
                  <ChipButton
                    key={opt.value}
                    active={settings.quality === opt.value}
                    onClick={() => onSettingsChange({ quality: opt.value })}
                  >
                    {opt.label}
                  </ChipButton>
                ))}
              </div>
            </section>
          )}

          {capability.showAdvancedSliders && (
            <section className="space-y-3">
              <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label={t('panel.advanced.label')} />
              <SliderRow
                label="CFG"
                value={settings.guidanceScale}
                min={1}
                max={20}
                step={0.5}
                onChange={(value) => onSettingsChange({ guidanceScale: value })}
              />
              <SliderRow
                label="Steps"
                value={settings.steps}
                min={4}
                max={60}
                step={1}
                onChange={(value) => onSettingsChange({ steps: value })}
              />
              <input
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                placeholder={t('panel.advanced.seedPlaceholder')}
                value={settings.seed}
                onChange={(e) => onSettingsChange({ seed: e.target.value })}
              />
            </section>
          )}

          <section className="space-y-2">
            <PanelLabel icon={<Wand2 className="size-3.5" />} label={t('panel.style.label')} />
            <SelectLike
              value={settings.stylePreset}
              options={STYLE_PRESET_VALUES.map((value) => ({ label: tStyle(value), value }))}
              onChange={(stylePreset) => onSettingsChange({ stylePreset })}
            />
            {capability.supportsNegativePrompt !== 'none' && (
              <div className="space-y-1">
                <textarea
                  className="min-h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder={t('panel.style.negativePlaceholder')}
                  value={settings.negativePrompt}
                  onChange={(e) => onSettingsChange({ negativePrompt: e.target.value })}
                />
                {capability.supportsNegativePrompt === 'prompt-injected' && settings.negativePrompt.trim() && (
                  <p className="text-[11px] text-muted-foreground">
                    {t('panel.style.negativeHint')}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}
