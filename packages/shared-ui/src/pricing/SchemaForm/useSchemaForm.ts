'use client';

import { useCallback, useMemo, useState } from 'react';
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
  const [params, setParams] = useState<Record<string, unknown>>(() =>
    schema ? fillDefaults(schema) : {},
  );
  const [message, setMessage] = useState<ClampMessage | undefined>(undefined);

  // 模型切换：schema 引用变化时跑迁移。用 React 官方"渲染期间根据 prop 调整
  // state"模式（state 记一份"上一个 schema"，而不是 ref）——不能用
  // useEffect + schema 依赖，因为迁移结果必须在同一次渲染里可用于表单，与
  // §6.4"钳制必须同步"同一条原则，这里是"迁移必须同步"。
  //
  // 之前用 useRef 在渲染期间直接赋值 `previousSchemaRef.current = schema`：
  // ref 的写入不受 React 渲染事务保护，一次被丢弃的渲染（StrictMode 双调用、
  // 并发特性打断重渲染）也会把 ref 改掉，导致下一次真正提交的渲染把这次
  // schema 切换错当成"已经处理过"而跳过迁移。改成 useState 后，"渲染中
  // setState" 是 React 承认的派生状态写法：被丢弃的渲染里调用的 setState 不会
  // 生效，只有真正提交的渲染才会推进 previousSchema，迁移不会被跳过。
  const [previousSchema, setPreviousSchema] = useState<ParamsSchema | undefined>(schema);
  if (schema !== previousSchema) {
    setPreviousSchema(schema);
    setParams(schema ? migrateParams(previousSchema, schema, params) : {});
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
