import { SlidersHorizontal, Settings2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '../../../ui/utils';
import {
  RATIO_VALUES,
  RESOLUTION_VALUES,
  VIDEO_MODE_VALUES,
  type VideoWorkspaceMode,
} from '../constants';
import { NumberStepper } from '../shared/NumberStepper';
import { ParamCardGroup } from '../shared/ParamCardGroup';
import { PanelLabel } from '../shared/PanelLabel';

export function VideoParameterPanel({
  open,
  mode,
  params,
  hasClip,
  onClose,
  onModeChange,
  onParamChange,
}: {
  open: boolean;
  mode: VideoWorkspaceMode;
  params: Record<string, unknown>;
  hasClip: boolean;
  onClose: () => void;
  onModeChange: (mode: VideoWorkspaceMode) => void;
  onParamChange: (partial: Record<string, unknown>, removeKeys?: string[]) => void;
}) {
  const t = useTranslations('videoWorkbench.parameterPanel');
  const tModes = useTranslations('videoWorkbench.modes');
  const tRatios = useTranslations('videoWorkbench.ratios');
  const tResolutions = useTranslations('videoWorkbench.resolutions');
  const disabled = !hasClip;

  const modeOptions = VIDEO_MODE_VALUES.map((value) => ({
    value,
    label: tModes(`${value}.label`),
  }));
  const resolutionOptions = RESOLUTION_VALUES.map((value) => ({
    value,
    label: tResolutions(value),
  }));
  const ratioOptions = RATIO_VALUES.map((value) => ({
    value,
    label: tRatios(value),
  }));

  return (
    <aside
      className={cn(
        'min-h-0 border-r border-border bg-muted/14',
        open
          ? 'fixed inset-y-0 left-0 z-40 flex w-[min(92vw,360px)] flex-col bg-background shadow-xl'
          : 'hidden',
        'xl:static xl:z-auto xl:flex xl:flex-col xl:bg-muted/14 xl:shadow-none',
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{t('title')}</h2>
            <p className="truncate text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
          <button
            type="button"
            aria-label={t('closeAria')}
            className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground xl:hidden"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-5">
          <section className="space-y-2">
            <PanelLabel icon={<Settings2 className="size-3.5" />} label={t('modeLabel')} />
            <div className="grid grid-cols-3 gap-2">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'rounded-lg border px-3 py-2 text-center text-xs transition-colors',
                    mode === option.value
                      ? 'border-primary bg-primary/8 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  onClick={() => onModeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label={t('basicsLabel')} />
            {mode !== 'storyboard' && (
              <NumberStepper
                label={t('durationLabel')}
                value={Number(params.duration ?? 5)}
                min={5}
                max={15}
                step={1}
                suffix="s"
                onChange={(value) => onParamChange({ duration: value })}
                disabled={disabled}
              />
            )}
            <ParamCardGroup
              label={t('resolutionLabel')}
              value={String(params.resolution ?? '720p')}
              options={resolutionOptions}
              onChange={(value) => onParamChange({ resolution: value })}
              disabled={disabled}
            />
            <ParamCardGroup
              label={t('ratioLabel')}
              value={String(params.ratio ?? '16:9')}
              options={ratioOptions}
              onChange={(value) => onParamChange({ ratio: value })}
              disabled={disabled}
            />
            <ParamCardGroup
              label={t('audioLabel')}
              value={params.generateAudio === false || params.generate_audio === false ? 'off' : 'on'}
              options={[
                { label: t('audioOn'), value: 'on' },
                { label: t('audioOff'), value: 'off' },
              ]}
              onChange={(value) => onParamChange({ generateAudio: value === 'on' }, ['generate_audio'])}
              disabled={disabled}
            />
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">{t('seedLabel')}</span>
              <input
                className="h-9 rounded-md border border-border bg-background px-3 outline-none focus:border-primary"
                placeholder={t('seedPlaceholder')}
                value={params.seed == null ? '' : String(params.seed)}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  onParamChange(value ? { seed: Number(value) } : {}, ['seed']);
                }}
                disabled={disabled}
              />
            </label>
          </section>
        </div>
      </div>
    </aside>
  );
}
