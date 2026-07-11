'use client';

import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import { affectedParams, priceOptions } from '@autix/domain/pricing';
import { layoutProperties } from './schema-layout';
import { useSchemaForm, type UseSchemaFormResult } from './useSchemaForm';
import { CONTROL_REGISTRY, type RegisteredControl } from './controlRegistry';
import { PriceTag } from './PriceTag';
import type { ChoiceControlProps } from './types';

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
}

/**
 * 顶层 schema 驱动渲染器（spec §6.6）：按 layoutProperties 的分组渲染，
 * 跳过 x-ui.control === 'hidden' 的属性，按 x-ui.control 分发到
 * CONTROL_REGISTRY 里对应的控件。
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
}: SchemaFormProps) {
  const internalForm = useSchemaForm(externalForm ? undefined : paramsSchema);
  const form = externalForm ?? internalForm;

  const priced = priceOptions(paramsSchema, pricingSchema, form.params, pricingContext);
  const groups = layoutProperties(paramsSchema);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.group ?? '__ungrouped'} className="space-y-3">
          {group.entries.map(({ name, property }) => {
            const control = property['x-ui']?.control;
            if (!control || control === 'hidden') return null;
            const Control = CONTROL_REGISTRY[control as RegisteredControl];
            if (!Control) return null;

            const label = translateLabel(property['x-ui']?.labelKey, name);
            const value = form.params[name];

            if (control === 'chips' || control === 'select') {
              const prices = priced[name];
              const options = (property.enum ?? []).map((candidate) => ({
                value: candidate,
                label: translateOption(property['x-ui']?.optionLabelKeys?.[String(candidate)], String(candidate)),
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
