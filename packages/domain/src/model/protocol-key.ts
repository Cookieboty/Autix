// 通用的 protocolKey 读取器。
//
// 为什么不用 readImageModelMetadata：它还读 modelFamily/operations/limits 等**图片专有**
// 字段，语义上宣称在读「图片模型元数据」。视频侧只需要 protocolKey 一个。抽出来两边共用
// 同一套解析语义，避免一边认空串、一边不认这类分叉。

/** 从 model_configs.metadata 读 protocolKey。空串/空白/非字符串一律视为「未声明」。 */
export function readProtocolKey(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const raw = (metadata as Record<string, unknown>).protocolKey;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}
