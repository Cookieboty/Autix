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

/**
 * 跨配置校验：paramsSchema（DB 下发，运营可配）⟷ preset 的 paramBindings（代码里的协议
 * 知识）必须闭合。
 *
 * 正向闭合（方向同 image/protocol/validate-config.ts:49-58）：schema 里 role 为
 * wire/both 的**标量**属性必须在 preset 里有绑定 —— 否则用户以为调了参数、上游其实
 * 永远收不到（静默丢弃）。
 *
 * **不再有反向白名单**：原生化后 paramBindings 的 key 就是火山 wire 字段名（key==path），
 * 拼错 = wire 请求体错 = golden 逐字节比对会红。原先的 UNIFIED_VIDEO_PARAM_KEYS 是
 * 「统一内部词汇」时代为跨 preset 校验绑定名而设的全局白名单，原生化后它恰好等于绑定名
 * 集合、变成自己校验自己的冗余，已删。
 *
 * **素材字段例外**：带 `x-content-role` 的属性（first_frame / reference_images /
 * reference_video / reference_audio 等）通过 video_clip_materials 表走 content 组装，
 * 不是标量 wire 参数、不进 paramBindings —— 正向闭合跳过它们。
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
    const prop = property as {
      'x-ui'?: { role?: string };
      'x-content-role'?: string;
    };
    // 素材字段（走 materials 表，不通过 paramBindings 发标量）不参与正向闭合。
    if (prop['x-content-role'] !== undefined) continue;
    const role = prop['x-ui']?.role ?? 'both';
    if (!WIRE_ROLES.has(role)) continue;
    if (bindings[name] === undefined) {
      violations.push({
        code: 'WIRE_PARAM_NOT_BOUND',
        param: name,
        message: `param "${name}" (role: ${role}) has no binding in preset "${preset.key}" — it would be silently dropped`,
      });
    }
  }

  return violations;
}
