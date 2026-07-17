import { setPath } from '../../core/bind';
import type {
  ContentBinding,
  VideoBindingSpec,
  VideoCallRequest,
} from './types';

/** 该值是否应被省略。omitWhen 与 omitValues 是「或」关系。 */
function shouldOmit(spec: VideoBindingSpec, value: unknown): boolean {
  if (value === undefined) return true; // 未设置的参数一律不发
  if (spec.omitWhen === 'falsy' && !value) return true;
  if (spec.omitValues?.some((sentinel) => sentinel === value)) return true;
  return false;
}

function applyValueMap(spec: VideoBindingSpec, value: unknown): unknown {
  if (!spec.valueMap) return value;
  const mapped = spec.valueMap[String(value)];
  return mapped === undefined ? value : mapped;
}

function buildContent(binding: ContentBinding, req: VideoCallRequest): unknown[] {
  const items: unknown[] = [];

  // 对齐 buildContent 的 `if (prompt)`：空串/null 不写 text item。
  if (req.prompt) {
    items.push({ type: binding.textItem.type, [binding.textItem.field]: req.prompt });
  }

  for (const material of req.materials) {
    const roleSpec = binding.roleItems[material.role];
    if (!roleSpec) {
      // 认不出的角色必须炸，不能静默丢弃 —— 静默丢素材 = 用户以为传了参考图、
      // 实际上游从没收到，且无人察觉。
      throw new Error(`No role item spec for material role "${material.role}"`);
    }
    items.push({
      type: roleSpec.type,
      [roleSpec.urlField]: { url: material.url },
      [binding.roleField]: roleSpec.role,
    });
  }

  return items;
}

/**
 * 统一参数 + 素材 → 厂商请求体。
 *
 * 引擎不认识 clip 词汇 —— `req.params` 必须已经过 toUnifiedVideoParams 投影
 * （domain/video/params.ts）。paramBindings 的 key 就是统一参数名。
 */
export function assembleVideoRequest(req: VideoCallRequest): Record<string, unknown> {
  const { submit } = req.preset;
  const body: Record<string, unknown> = { ...(submit.staticBody ?? {}) };

  setPath(body, submit.model.path, req.model);
  setPath(body, submit.content.path, buildContent(submit.content, req));

  for (const [key, spec] of Object.entries(submit.paramBindings)) {
    const raw = req.params[key];
    if (shouldOmit(spec, raw)) continue;
    setPath(body, spec.path, applyValueMap(spec, raw));
  }

  const webhook = req.preset.webhook;
  if (webhook && req.callbackUrl && !shouldOmit(webhook.callbackUrlBinding, req.callbackUrl)) {
    setPath(body, webhook.callbackUrlBinding.path, req.callbackUrl);
  }

  return body;
}
