import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject, ValidateFunction } from 'ajv';
import type { ParamsSchema } from './types';

export interface ParamViolation {
  /** JSON Pointer，如 "/resolution"。根级错误为 ""。 */
  path: string;
  message: string;
}

/**
 * ajv 的 strict 家族选项完全保持默认开启，不做局部关闭。
 *
 * `x-ui` 是本项目的非标扩展，ajv 默认 strict 模式会把未知关键字当错误抛出，
 * 用 `addKeyword` 声明为已知关键字后 ajv 会跳过它。
 *
 * 定价 schema 常见写法是 `allOf[].then.properties.<x>`，其中 `then` 分支必须
 * 自带 `type`（例如 `{ type: 'integer', maximum: 8 }`），不能只写 `{ maximum: 8 }`
 * 指望复用外层 `properties.<x>.type`——strict 模式下的类型检查是逐子 schema
 * 独立生效的，看不到外层类型。定价 schema 由后台管理界面编辑，若把这项类型检查
 * 关掉，类似 `then: { properties: { resolution: { maximum: 8 } } }`（对字符串
 * 参数误用数值关键字）这种编写错误会被 ajv 静默接受、约束永不生效。因此宁可让
 * 作者在每个 then 分支多写一个 type，也不要为图省事关闭这项检查。
 */
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addKeyword({ keyword: 'x-ui', valid: true });

/** 编译结果按 schema 对象身份缓存 —— schema 来自 DB，每次请求是新对象时缓存不命中，属可接受成本。 */
const compiled = new WeakMap<ParamsSchema, ValidateFunction>();

function compile(schema: ParamsSchema): ValidateFunction {
  const cached = compiled.get(schema);
  if (cached) return cached;
  const fn = ajv.compile(schema);
  compiled.set(schema, fn);
  return fn;
}

function toViolation(error: ErrorObject): ParamViolation {
  return {
    path: error.instancePath,
    message: error.message ?? 'invalid',
  };
}

/** 返回空数组表示合法。后端在扣费前必须调用它——前端的校验只是体验优化。 */
export function validateParams(
  schema: ParamsSchema,
  params: Record<string, unknown>,
): ParamViolation[] {
  const validate = compile(schema);
  if (validate(params)) return [];
  return (validate.errors ?? []).map(toViolation);
}
