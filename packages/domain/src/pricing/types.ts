export type XUiControl =
  | 'chips' | 'select' | 'slider' | 'stepper' | 'switch' | 'text' | 'textarea' | 'hidden'
  | 'size-grid';

/**
 * 参数在三条链路上的去向。缺省（未写）= 'both'，向后兼容存量 schema。
 *
 * | role      | 计价 | 上游 body | 表单 |
 * |-----------|------|-----------|------|
 * | 'pricing' | ✅   | ❌        | 由 control 决定 |
 * | 'wire'    | ❌   | ✅        | 由 control 决定 |
 * | 'both'    | ✅   | ✅        | 由 control 决定 |
 * | 'derived' | ✅   | ❌        | ❌（服务端算，前端传的一律覆盖）|
 *
 * ⚠ role 与 control 正交：control 管「渲不渲染」，role 管「值去哪」。
 */
export type XUiRole = 'pricing' | 'wire' | 'both' | 'derived';

/** 派生函数白名单。新增派生函数必须同时在这里、validate-schema 的 DERIVE_FNS、
 *  以及 derive.ts 的注册表三处登记。 */
export type DeriveFn = 'imagePricingResolution';

export interface DerivedFrom {
  /** 源参数名。必须存在于同一份 paramsSchema，且不能是自己。 */
  param: string;
  via: DeriveFn;
}

export interface XUi {
  control: XUiControl;
  labelKey?: string;
  optionLabelKeys?: Record<string, string>;
  /**
   * 字面量选项 label（语言无关标记，如 '1:1' / '16:9' / '2K'）。
   * 优先级：optionLabelKeys[v] > optionLabels[v] > 原始值。
   */
  optionLabels?: Record<string, string>;
  group?: string;
  /** 逐模型的选项分组规则（如 size 按 tier 分组）。**不来自 modelFamily**（spec 口径 1）。 */
  groupBy?: string;
  order?: number;
  step?: number;
  role?: XUiRole;
  /** 仅当 role === 'derived' 时有意义；此时它是必填的。 */
  derivedFrom?: DerivedFrom;
  /**
   * When a param's value is determined, not whether it renders (`control`/`hidden`
   * are orthogonal to this). Spec §3.1.1.65.
   *
   * - `'params'` (default when absent): determined at order time, frozen into
   *   `PricingSnapshot.params`, immutable at settlement. e.g. `quality`,
   *   `resolution`, `seconds`, `referenceImages`.
   * - `'usage'`: determined at settlement time, NOT frozen, supplied by the real
   *   `usage` passed to `quoteTaskFromSnapshot`. e.g. `inputTokens`, `outputTokens`.
   */
  valueSource?: 'params' | 'usage';
  /**
   * UI-facing cap on how many files the user may attach (e.g. reference images).
   * Deliberately NOT a JSON-Schema `maximum` — ajv would then reject legitimate
   * multi-image requests from other callers (chat/canvas) sharing this same task schema.
   */
  uploadMax?: number;
}

export interface JsonSchemaProperty {
  type: 'string' | 'integer' | 'number' | 'boolean';
  enum?: (string | number)[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  'x-ui'?: XUi;
}

export interface ParamsSchema {
  $schema?: string;
  type: 'object';
  required?: string[];
  properties: Record<string, JsonSchemaProperty>;
  allOf?: Record<string, unknown>[];
}

export type ClauseOp = 'eq' | 'ne' | 'in' | 'gt' | 'gte' | 'lt' | 'lte';

export interface Clause {
  param: string;
  op: ClauseOp;
  value: unknown;
}

/** 仅合取。无 or，无嵌套，无跨参数比较。 */
export interface Predicate {
  all: Clause[];
}

export type TermOp = 'add' | 'mul';

export interface ConstSource {
  const: number;
}

export interface TableSource {
  table: {
    param: string;
    values: Record<string, number>;
    /** 查表未命中时的取值。缺省则该 term 被跳过。 */
    fallback?: number;
  };
}

export interface PerUnitSource {
  perUnit: {
    param: string;
    unitCost: number;
    /** 缺省为 1。 */
    divisor?: number;
  };
}

/** 三种取值源互斥且必须恰好有一个。 */
export type TermValueSource = ConstSource | TableSource | PerUnitSource;

export type Term = {
  id: string;
  op: TermOp;
  when?: Predicate;
} & TermValueSource;

export interface PricingSchema {
  terms: Term[];
}

export interface Breakdown {
  id: string;
  op: TermOp;
  /** 该 term 解析出的取值。 */
  contribution: number;
  /** 应用该 term 后的累加器值。 */
  accumulatorAfter: number;
}

export interface EvalResult {
  /** 未取整。取整只在 quoteTask 的链路末端发生一次。 */
  total: number;
  breakdown: Breakdown[];
}
