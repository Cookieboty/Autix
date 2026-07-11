'use client';

import { useEffect, useRef } from 'react';
import type { UseSchemaFormResult } from './useSchemaForm';

/**
 * 把 SchemaForm 表单与外部生成设置做双向同步，避免 P1-3 里那些坑：
 * - 外部设置(反向映射后的 externalParams：模板应用 / 历史恢复 / 其它工具栏改了 settings)
 *   变化时，同步进表单；
 * - 用户真正改动表单时，才把扁平 params 上抛给 onParamsChange(父组件再正向映射回 settings)；
 * - 跳过「挂载」与「外部同步的回声」两种非用户改动，从而：
 *     · 挂载时不会用 schema 默认值覆盖已有设置(表单本身用 externalParams 作为
 *       useSchemaForm 的 initialParams 初始化，起点即为当前设置)；
 *     · 改一个字段不会把其余字段回写成旧值；
 *     · 不产生 settings -> form -> settings 的死循环。
 */
export function useSchemaFormExternalSync(
  form: UseSchemaFormResult,
  externalParams: Record<string, unknown>,
  onParamsChange: (params: Record<string, unknown>) => void,
): void {
  const externalKey = JSON.stringify(externalParams);
  // 上一次「已同步/已上抛」的 form.params 序列化 key。挂载时初始化为当前 params，
  // 使挂载这次 effect 被判为「已处理」而跳过，不上抛默认值。
  const lastParamsKeyRef = useRef(JSON.stringify(form.params));
  const syncedExternalKeyRef = useRef(externalKey);

  // 外部设置 -> 表单
  useEffect(() => {
    if (externalKey === syncedExternalKeyRef.current) return;
    syncedExternalKeyRef.current = externalKey;
    const merged = { ...form.params, ...externalParams };
    // 标记这次 params 变化是「外部同步」，让下面的上抛 effect 跳过它(不回声)。
    lastParamsKeyRef.current = JSON.stringify(merged);
    form.replaceParams(merged);
    // 仅在 externalKey 变化时同步；form 由 ref 读取，刻意不入依赖。
  }, [externalKey]);

  // 表单 -> 外部设置(仅用户真正改动)
  useEffect(() => {
    const key = JSON.stringify(form.params);
    if (key === lastParamsKeyRef.current) return;
    lastParamsKeyRef.current = key;
    onParamsChange(form.params);
    // onParamsChange 由父组件每次渲染新建，只在 form.params 变化时触发，刻意不入依赖。
  }, [form.params]);
}
