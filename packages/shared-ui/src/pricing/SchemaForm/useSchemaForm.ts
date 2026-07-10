'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ParamsSchema } from '@autix/domain/pricing';
import { clampOnChange, fillDefaults, migrateParams, type ClampMessage } from './schema-form-logic';

export interface UseSchemaFormResult {
  params: Record<string, unknown>;
  message: ClampMessage | undefined;
  setParam: (field: string, value: unknown) => void;
  /** 直接替换（例如从服务端 quote 得到的、通过校验的规范化值）。绕过钳制。 */
  replaceParams: (params: Record<string, unknown>) => void;
}

/**
 * schema 为 undefined 表示尚未拉到（见 SchemaForm 的错误处理，spec §6.8：
 * schema 拉取失败时禁用生成，不 fallback 到硬编码默认值）。
 */
export function useSchemaForm(schema: ParamsSchema | undefined): UseSchemaFormResult {
  const previousSchemaRef = useRef<ParamsSchema | undefined>(undefined);
  const [params, setParams] = useState<Record<string, unknown>>(() =>
    schema ? fillDefaults(schema) : {},
  );
  const [message, setMessage] = useState<ClampMessage | undefined>(undefined);

  // 模型切换：schema 引用变化时跑迁移。用 ref 记录上一个 schema 而不是
  // useEffect + schema 依赖，因为迁移结果必须在同一次渲染里可用于表单——
  // 与 §6.4"钳制必须同步"同一条原则，这里是"迁移必须同步"。
  if (schema !== previousSchemaRef.current) {
    const migrated = schema ? migrateParams(previousSchemaRef.current, schema, params) : {};
    previousSchemaRef.current = schema;
    if (migrated !== params) {
      // 用函数式更新避免把 migrated 放进依赖数组触发的无限渲染；
      // 这里是渲染期间的同步 setState（React 允许，等价于 state 派生）。
      setParams(migrated);
    }
  }

  const setParam = useCallback(
    (field: string, value: unknown) => {
      if (!schema) return;
      const result = clampOnChange(schema, params, field, value);
      setParams(result.params);
      setMessage(result.message);
    },
    [schema, params],
  );

  const replaceParams = useCallback((next: Record<string, unknown>) => {
    setParams(next);
    setMessage(undefined);
  }, []);

  return useMemo(
    () => ({ params, message, setParam, replaceParams }),
    [params, message, setParam, replaceParams],
  );
}
