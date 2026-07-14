'use client';

import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import { priceOptions } from '@autix/domain/pricing';
import { layoutProperties } from './schema-layout';
import { resolveOptionLabel, visibleEntries } from './schema-form-logic';
import { useSchemaForm, type UseSchemaFormResult } from './useSchemaForm';
import { CONTROL_REGISTRY, type RegisteredControl } from './controlRegistry';
import { PriceTag } from './PriceTag';
import type { ChoiceControlProps, SizeGridControlProps } from './types';

export interface SchemaFormProps {
  paramsSchema: ParamsSchema;
  pricingSchema: PricingSchema;
  pricingContext: { multiplier: number; discountFactor: number };
  /** 由 SchemaForm 内部管理表单态时传 undefined 走内部 useSchemaForm；
   *  若父组件需要控制态（例如 quote 触发依赖它），传入已有的 useSchemaForm() 结果。 */
  form?: UseSchemaFormResult;
  disabled?: boolean;
  /** x-ui.labelKey → 翻译后的文案。缺失时回退到裸 key（spec §6.9）。 */
  translateLabel: (labelKey: string | undefined, fallback: string) => string;
  translateOption: (optionLabelKey: string | undefined, fallback: string) => string;
  /**
   * Property names to skip rendering even though the schema doesn't mark them
   * `x-ui.control: 'hidden'` — e.g. a UI-level mode toggle (not part of the schema itself)
   * that should suppress a normally-visible field for the current mode. Kept separate from the
   * schema's own `hidden` control so callers don't have to fork/rewrite the schema per mode.
   */
  hiddenFields?: readonly string[];
}

/**
 * 顶层 schema 驱动渲染器（spec §6.6）：按 layoutProperties 的分组渲染，
 * 渲染谁由 visibleEntries() 这一个纯函数决定——跳过 x-ui.control === 'hidden'，
 * 以及**任何** role: 'derived' 的属性（哪怕它的 control 被配错成可见控件，
 * spec §6.1 role 表），再按 x-ui.control 分发到 CONTROL_REGISTRY 里对应的控件。
 *
 * 哪些 enum 选项该挂 PriceTag，不在这里判断——priceOptions() 本身只对
 * affectedParams(pricingSchema) 里的属性返回价格表（见
 * packages/domain/src/pricing/introspect.ts），非受影响属性在 `priced` 里
 * 天然缺席，这里只是读取 `priced[name]` 是否存在，不重复 affectedParams 的
 * 判断逻辑。
 *
 * 不 import validateParams/ajv：保持 ajv 出前端 bundle，tree-shaking 依赖
 * 只引入这些纯函数。
 */
export function SchemaForm({
  paramsSchema,
  pricingSchema,
  pricingContext,
  form: externalForm,
  disabled,
  translateLabel,
  translateOption,
  hiddenFields,
}: SchemaFormProps) {
  const internalForm = useSchemaForm(externalForm ? undefined : paramsSchema);
  const form = externalForm ?? internalForm;

  const priced = priceOptions(paramsSchema, pricingSchema, form.params, pricingContext);
  const groups = layoutProperties(paramsSchema);
  const visibleNames = new Set(visibleEntries(paramsSchema).map((e) => e.name));

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.group ?? '__ungrouped'} className="space-y-3">
          {group.entries.map(({ name, property }) => {
            if (hiddenFields?.includes(name)) return null;
            if (!visibleNames.has(name)) return null;
            const control = property['x-ui']?.control;
            if (!control) return null;
            const Control = CONTROL_REGISTRY[control as RegisteredControl];
            if (!Control) return null;

            const label = translateLabel(property['x-ui']?.labelKey, name);
            const value = form.params[name];

            if (control === 'chips' || control === 'select') {
              const prices = priced[name];
              const options = (property.enum ?? []).map((candidate) => ({
                value: candidate,
                label: resolveOptionLabel(property['x-ui'], String(candidate), translateOption),
                priceTag: prices ? (
                  <PriceTag price={prices[String(candidate)]} active={candidate === value} />
                ) : undefined,
              }));
              return (
                <Control
                  key={name}
                  {...({
                    label,
                    value: value as string | number,
                    options,
                    onChange: (next: string | number) => form.setParam(name, next),
                    disabled,
                  } satisfies ChoiceControlProps)}
                />
              );
            }

            if (control === 'size-grid') {
              // size 是 role: 'wire'（不计价），priceOptions() 天然不会为它挂价签
              // （packages/domain/src/pricing/introspect.ts 跳过 wire 属性）——
              // 这里不重复该判断，直接不传 priceTag。
              const options = (property.enum ?? []).map((candidate) => ({
                value: String(candidate),
                label: resolveOptionLabel(property['x-ui'], String(candidate), translateOption),
              }));
              return (
                <Control
                  key={name}
                  {...({
                    label,
                    value: String(value ?? ''),
                    options,
                    groupBy: property['x-ui']?.groupBy,
                    onChange: (next: string) => form.setParam(name, next),
                    disabled,
                  } satisfies SizeGridControlProps)}
                />
              );
            }

            if (control === 'slider' || control === 'stepper') {
              return (
                <Control
                  key={name}
                  {...{
                    label,
                    value: Number(value ?? property.default ?? property.minimum ?? 0),
                    min: property.minimum ?? 0,
                    max: property.maximum ?? 100,
                    step: property['x-ui']?.step,
                    onChange: (next: number) => form.setParam(name, next),
                    disabled,
                  }}
                />
              );
            }

            if (control === 'switch') {
              return (
                <Control
                  key={name}
                  {...{
                    label,
                    value: Boolean(value),
                    onChange: (next: boolean) => form.setParam(name, next),
                    disabled,
                  }}
                />
              );
            }

            // text / textarea
            return (
              <Control
                key={name}
                {...{
                  label,
                  value: String(value ?? ''),
                  onChange: (next: string) => form.setParam(name, next),
                  disabled,
                }}
              />
            );
          })}
          {group.entries.some(({ name }) => form.message?.field === name) && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">{form.message?.text}</p>
          )}
        </section>
      ))}
    </div>
  );
}
