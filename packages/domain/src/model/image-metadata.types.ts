export type ImageOperation = 'generate' | 'edit';

export interface ImageModelLimits {
  /** 单次最多出几张。**不是请求参数**——上游要的是 `n`，不是「n 的上限」（spec §5.2）。 */
  maxCount?: number;
}

export interface ImageModelMetadata {
  /** 仅展示（spec 口径 1）。代码里不得出现 `switch (modelFamily)`。 */
  modelFamily?: string;
  /** 路由到 protocol preset。第 2 期才有消费者。 */
  protocolKey?: string;
  operations?: ImageOperation[];
  limits?: ImageModelLimits;
}
