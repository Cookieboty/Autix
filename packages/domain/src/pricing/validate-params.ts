import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject, ValidateFunction } from 'ajv';
import type { ParamsSchema } from './types';

export interface ParamViolation {
  /** JSON Pointer，如 "/resolution"。根级错误为 ""。 */
  path: string;
  message: string;
}

/**
 * `x-ui` 是本项目的非标扩展，ajv 默认 strict 模式会把未知关键字当错误抛出。
 * 声明为已知关键字后 ajv 会跳过它。
 *
 * `strictTypes: false`：定价 schema 常见写法是 `allOf[].then.properties.<x>`
 * 只写 `{ maximum: 8 }` 而不重复 `type`（外层 `properties.<x>.type` 已声明过）。
 * ajv 的 strictTypes 检查是逐子 schema 独立生效的，看不到外层的 type，会把这种写法
 * 当成"数值关键字用在未声明类型的 schema 上"而抛异常。关掉它不影响未知关键字检测
 * （仍由 strict 的其余部分负责，x-ui 之外的拼写错误仍会被拒绝）。
 */
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
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
