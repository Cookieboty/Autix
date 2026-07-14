import type { ComponentType } from 'react';
import type { XUiControl } from '@autix/domain/pricing';
import { ChipsControl } from './controls/ChipsControl';
import { SelectControl } from './controls/SelectControl';
import { SizeGridControl } from './controls/SizeGridControl';
import { SliderControl } from './controls/SliderControl';
import { StepperControl } from './controls/StepperControl';
import { SwitchControl } from './controls/SwitchControl';
import { TextControl } from './controls/TextControl';
import { TextareaControl } from './controls/TextareaControl';

export type RegisteredControl = Exclude<XUiControl, 'hidden'>;

/**
 * x-ui.control → 组件的唯一映射表。控件契约本身（哪个 control 需要哪些
 * schema 关键字）由后端 validateParamsSchema 在保存时强制（spec §6.2），
 * 这张表只负责渲染分发，不重复校验。
 *
 * The `Record<RegisteredControl, ...>` annotation (not a hand-rolled object
 * type) is load-bearing: it ties this literal's key set to `XUiControl`
 * itself, so adding/removing/renaming a control on the domain union makes
 * this object fail `tsc` (missing or excess property) until it's updated
 * here — the same guarantee the registry test asserts at runtime for the
 * current key set.
 */
export const CONTROL_REGISTRY: Record<RegisteredControl, ComponentType<any>> = {
  chips: ChipsControl,
  select: SelectControl,
  'size-grid': SizeGridControl,
  slider: SliderControl,
  stepper: StepperControl,
  switch: SwitchControl,
  text: TextControl,
  textarea: TextareaControl,
};
