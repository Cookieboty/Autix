'use client';

import { Maximize2, Settings2, Sparkles } from 'lucide-react';
import type { ParamsSchema } from '@autix/domain/pricing';
import { buildSizeGridView, resolveOptionLabel, visibleEntries } from '../../../pricing';
import type { UseSchemaFormResult } from '../../../pricing';
import { AspectRatioIcon, ImageOptionParamMenu } from './ImageParamMenus';

/**
 * 公开生成器的参数区：**schema 驱动，但沿用生成器原有的紧凑 pill 菜单外观**。
 *
 * 为什么不直接用 `SchemaForm`：SchemaForm 是**管理端/工作台**那套「一行一个控件、
 * chips 平铺、选项上挂价签」的表单布局。生成器的输入框是一条窄横条，参数必须是
 * 与「模型」「可见性」并排的下拉 pill——把 chips 铺进去会把输入区撑成两倍高，
 * 且每个选项上挂积分数字（价签）在这里是噪音：用户只需要看**总价**（TotalPriceBar）。
 *
 * 但**参数从哪来、怎么分组、怎么取 label，全部仍来自 schema**（`visibleEntries` /
 * `buildSizeGridView` / `resolveOptionLabel` 三个纯函数与 SchemaForm 共用）——
 * 静态能力表不再参与（口径 1、2：语义与分组来自该模型的 `x-ui`，不来自 modelFamily）。
 */
export function ImageSchemaParamMenus({
  paramsSchema,
  form,
  translateLabel,
  translateOption,
  aspectTitle,
  resolutionTitle,
}: {
  paramsSchema: ParamsSchema;
  form: UseSchemaFormResult;
  translateLabel: (labelKey: string | undefined, fallback: string) => string;
  translateOption: (optionLabelKey: string | undefined, fallback: string) => string;
  aspectTitle: string;
  resolutionTitle: string;
}) {
  return (
    <>
      {visibleEntries(paramsSchema).map(({ name, property }) => {
        const ui = property['x-ui'];
        if (!ui) return null;

        const label = translateLabel(ui.labelKey, name);
        const current = String(form.params[name] ?? property.default ?? '');

        // size-grid：一个 schema 属性 → 两个菜单（长宽比 + 分辨率档位）。
        // 两个方向都由 domain 的选择器保序：切档位保住长宽比，切长宽比保住档位。
        if (ui.control === 'size-grid') {
          const options = (property.enum ?? []).map((value) => ({
            value: String(value),
            label: resolveOptionLabel(ui, String(value), translateOption),
          }));
          const view = buildSizeGridView(options, ui.groupBy, current);
          const hasTiers = view.groups.length > 1;

          return (
            <div key={name} className="contents">
              <ImageOptionParamMenu
                icon={<AspectRatioIcon value={view.selectedAspect ?? ''} />}
                label={view.selectedAspect ?? view.displayLabel}
                title={aspectTitle}
                options={view.aspectOptions.map((option) => ({
                  label: option.label,
                  value: option.aspectValue,
                }))}
                value={view.selectedAspect ?? ''}
                onChange={(next) => form.setParam(name, view.pickAspect(next))}
                renderOptionIcon={(value) => <AspectRatioIcon value={value} />}
              />
              {hasTiers ? (
                <ImageOptionParamMenu
                  icon={<Maximize2 className="size-4" />}
                  label={view.selectedTier ?? ''}
                  title={resolutionTitle}
                  options={view.groups.map((group) => ({
                    label: group.label,
                    value: group.value,
                  }))}
                  value={view.selectedTier ?? ''}
                  onChange={(next) => form.setParam(name, view.pickTier(next))}
                />
              ) : null}
            </div>
          );
        }

        // chips / select → 一个下拉 pill。**不挂价签**——总价由 TotalPriceBar 给出。
        if (ui.control === 'chips' || ui.control === 'select') {
          const options = (property.enum ?? []).map((value) => ({
            value: String(value),
            label: resolveOptionLabel(ui, String(value), translateOption),
          }));
          if (options.length === 0) return null;
          const selected = options.find((option) => option.value === current);

          return (
            <ImageOptionParamMenu
              key={name}
              icon={<Settings2 className="size-4" />}
              label={selected?.label ?? label}
              title={label}
              options={options}
              value={current}
              onChange={(next) => form.setParam(name, next)}
            />
          );
        }

        // 生成器这条横条上放不下 slider / stepper / textarea。schema 若真声明了它们，
        // 说明该模型的参数面板需要重新设计——静默不渲染会让用户改不到一个会计费的参数，
        // 所以这里显式画一个禁用 pill 把它暴露出来，而不是假装它不存在。
        return (
          <span
            key={name}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm font-semibold text-foreground/38"
            title={`${label}: ${ui.control}`}
          >
            <Sparkles className="size-4" />
            {label}
          </span>
        );
      })}
    </>
  );
}
