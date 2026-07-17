import { UNIFIED_VIDEO_PARAM_KEYS } from '@autix/domain/video';
import type { ParamsSchema } from '@autix/domain/pricing';
import type { VideoProtocolPreset } from './types';

/** 与 image 侧同构（image/protocol/validate-config.ts:7）。 */
export interface ConfigViolation {
  code: string;
  message: string;
  param?: string;
}

/** 会真正发给上游的角色。与 image 侧的 WIRE_ROLES 同义。 */
const WIRE_ROLES: ReadonlySet<string> = new Set(['wire', 'both']);

const KNOWN_UNIFIED: ReadonlySet<string> = new Set(UNIFIED_VIDEO_PARAM_KEYS);

/**
 * 跨配置校验：paramsSchema ⟷ preset 的 paramBindings 必须双向闭合。
 *
 * **方向很关键**：规则不是「绑定必须存在于 schema」—— 线上 video_generation 的 schema
 * 只有 resolution/seconds/ratio 三个属性，而 arkVideoV3 有 7 个绑定（generateAudio /
 * watermark / returnLastFrame / seed 是不进计价、不给用户选的传输参数，本就不该出现在
 * schema 里）。按那个方向写会拒绝 preset 自己。
 *
 * 正确的两条（方向同 image/protocol/validate-config.ts:49-58 的「规则 1a 正向闭合」）：
 *   1. 正向：schema 里 role 为 wire/both 的属性必须有绑定 —— 否则用户以为调了参数、
 *      上游其实永远收不到（静默丢弃）。
 *   2. 反向：绑定 key 不必在 schema 里，但必须属于 UNIFIED_VIDEO_PARAM_KEYS —— 否则
 *      一个拼错的 `wartermark` 绑定会永远不生效且无人察觉。
 */
export function validateVideoProtocolConfig(input: {
  paramsSchema: ParamsSchema;
  preset: VideoProtocolPreset;
}): ConfigViolation[] {
  const violations: ConfigViolation[] = [];
  const { preset } = input;
  const bindings = preset.submit.paramBindings;
  const properties = input.paramsSchema.properties ?? {};

  // 规则 1：正向闭合
  for (const [name, property] of Object.entries(properties)) {
    const role = (property as { 'x-ui'?: { role?: string } })['x-ui']?.role ?? 'both';
    if (!WIRE_ROLES.has(role)) continue;
    if (bindings[name] === undefined) {
      violations.push({
        code: 'WIRE_PARAM_NOT_BOUND',
        param: name,
        message: `param "${name}" (role: ${role}) has no binding in preset "${preset.key}" — it would be silently dropped`,
      });
    }
  }

  // 规则 2：反向白名单
  for (const name of Object.keys(bindings)) {
    if (!KNOWN_UNIFIED.has(name)) {
      violations.push({
        code: 'UNKNOWN_UNIFIED_PARAM',
        param: name,
        message: `preset "${preset.key}" binds "${name}", which is not a known unified video param — it would never take effect`,
      });
    }
  }

  return violations;
}
