export type XUiControl =
  | 'chips' | 'select' | 'slider' | 'stepper' | 'switch' | 'text' | 'textarea' | 'hidden';

export interface XUi {
  control: XUiControl;
  labelKey?: string;
  optionLabelKeys?: Record<string, string>;
  group?: string;
  order?: number;
  step?: number;
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
