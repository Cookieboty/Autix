import { resolveImagePricingResolution } from '@autix/domain/image';
import { readImageModelMetadata, type ImageOperation } from '@autix/domain/model';
import type { ParamsSchema, XUiRole } from '@autix/domain/pricing';
import { TRANSFORMS } from './transforms';
import type { BindingSpec, ParamStrategy, PixelSizeConstraints, ProtocolPreset } from './types';

export interface ConfigViolation { code: string; message: string; param?: string }

/** 逐条核对一个像素尺寸串（`WxH`）是否满足约束；满足返回 undefined，否则返回违规描述。 */
function checkPixelSize(value: string, c: PixelSizeConstraints): string | undefined {
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) return `not a WxH pixel string`;
  const width = Number(match[1]);
  const height = Number(match[2]);
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const pixels = width * height;
  const problems: string[] = [];
  if (c.maxEdge !== undefined && long > c.maxEdge) problems.push(`max edge ${long} > ${c.maxEdge}`);
  if (c.edgeMultipleOf !== undefined && (width % c.edgeMultipleOf !== 0 || height % c.edgeMultipleOf !== 0)) {
    problems.push(`edges not multiples of ${c.edgeMultipleOf}`);
  }
  if (short > 0 && long / short > c.maxRatio) problems.push(`ratio ${(long / short).toFixed(3)} > ${c.maxRatio}:1`);
  if (pixels < c.minPixels) problems.push(`pixels ${pixels} < ${c.minPixels}`);
  if (pixels > c.maxPixels) problems.push(`pixels ${pixels} > ${c.maxPixels}`);
  return problems.length ? problems.join('; ') : undefined;
}

const WIRE_ROLES: ReadonlySet<XUiRole> = new Set(['wire', 'both']);

/** 派生函数名 → 能否解析一个 token。规则 7 用它逐个校验源属性的 enum。 */
const CAN_PARSE: Record<string, (token: string) => boolean> = {
  imagePricingResolution: (token) => resolveImagePricingResolution(token) !== undefined,
};

function isStrategy(b: unknown): b is ParamStrategy {
  return typeof b === 'object' && b !== null && 'strategy' in b;
}

export function validateModelProtocolConfig(input: {
  paramsSchema: ParamsSchema;
  metadata: unknown;
  preset: ProtocolPreset | undefined;
}): ConfigViolation[] {
  const violations: ConfigViolation[] = [];
  const { paramsSchema, preset } = input;
  const meta = readImageModelMetadata(input.metadata);
  const properties = paramsSchema.properties ?? {};

  // 规则 5：协议存在性
  if (!preset) {
    violations.push({
      code: 'UNKNOWN_PROTOCOL_KEY',
      message: `metadata.protocolKey "${meta.protocolKey ?? '(missing)'}" resolves to no registered preset`,
    });
    return violations;   // 没有 preset，后面 6 条都无从谈起
  }

  const operations: ImageOperation[] = meta.operations ?? [];

  // 复合绑定（composeFrom）消费掉的统一参数：它们没有自己的直接绑定，但**已被发出去**。
  // 规则 1a 必须认这笔账，否则 gpt-image 的 aspectRatio/resolution 会被误判成「发不出去」。
  const composedSources = new Set<string>();
  for (const binding of Object.values(preset.paramBindings)) {
    if (isStrategy(binding) || Array.isArray(binding) || !binding.composeFrom) continue;
    for (const source of binding.composeFrom) composedSources.add(source);
  }

  // 规则 1a：正向闭合
  for (const [name, property] of Object.entries(properties)) {
    const role = property['x-ui']?.role ?? 'both';
    if (!WIRE_ROLES.has(role)) continue;
    if (preset.paramBindings[name] === undefined && !composedSources.has(name)) {
      violations.push({
        code: 'WIRE_PARAM_NOT_BOUND', param: name,
        message: `param "${name}" (role: ${role}) has no binding in preset "${preset.key}" — it would be silently dropped`,
      });
    }
  }

  // 规则 1b + 规则 4
  for (const [name, binding] of Object.entries(preset.paramBindings)) {
    // 复合绑定的**名字**不必是 schema 里的属性（gpt-image 的 `size` 就不是——它是
    // (aspectRatio × resolution) 的函数）。要校验的是它的**源参数**都存在且不是 derived，
    // 以及查表覆盖了源参数 enum 的每一个组合（规则 8，见下）。
    const composed =
      !isStrategy(binding) && !Array.isArray(binding) && binding.composeFrom ? binding : undefined;
    if (composed) {
      const sources = composed.composeFrom!;
      const present = sources.filter((source) => properties[source]);
      // 一个源都没有 = 这条复合绑定对该模型整体惰性（同上，超集 preset 的常态）。
      // 但**部分存在**是真 bug：拼不出完整的 key，绑定永远查不到表，参数被静默丢掉。
      if (present.length > 0 && present.length < sources.length) {
        violations.push({
          code: 'BINDING_TARGETS_UNKNOWN_PARAM', param: name,
          message: `preset "${preset.key}" composes "${name}" from [${sources.join(', ')}], but this model's paramsSchema only has [${present.join(', ')}] — the key can never be composed and the binding would be silently dropped`,
        });
      }
      for (const source of present) {
        const sourceProperty = properties[source]!;
        if ((sourceProperty['x-ui']?.role ?? 'both') === 'derived') {
          violations.push({
            code: 'BINDING_TARGETS_DERIVED_PARAM', param: source,
            message: `preset "${preset.key}" composes "${name}" from derived param "${source}" — derived params are computed for pricing, never sent upstream`,
          });
        }
      }
      if (composed.transform && !(composed.transform in TRANSFORMS)) {
        violations.push({
          code: 'UNKNOWN_TRANSFORM', param: name,
          message: `binding for "${name}" uses unknown transform "${composed.transform}"`,
        });
      }
      continue;
    }

    const property = properties[name];
    if (!property) {
      // 一个厂商 preset 会被同厂商、能力不同的多个模型共用（gemini 里只有 3.1-flash
      // 有 thinkingLevel），所以它必然绑定一个**超集**。对某个具体模型来说，绑定了它
      // 没有的参数是**惰性**的——assemble 遍历的是 req.params，绑定不会凭空造出一个值。
      //
      // 「preset 绑了一个谁都没有的参数」（作者拼错了）仍然要抓，但那是**注册表级**的
      // 检查（每个绑定至少被一个模型认领），不是逐模型的——否则会逼着同厂商所有模型
      // 长成一样。见 seed-pricing.spec.ts 的「preset 的每个绑定都至少被一个模型认领」。
      continue;
    }
    if ((property['x-ui']?.role ?? 'both') === 'derived') {
      violations.push({
        code: 'BINDING_TARGETS_DERIVED_PARAM', param: name,
        message: `preset "${preset.key}" binds derived param "${name}" — derived params are priced, never sent upstream`,
      });
    }
    if (isStrategy(binding)) continue;
    for (const spec of (Array.isArray(binding) ? binding : [binding]) as BindingSpec[]) {
      if (spec.transform && !(spec.transform in TRANSFORMS)) {
        violations.push({
          code: 'UNKNOWN_TRANSFORM', param: name,
          message: `binding for "${name}" uses unknown transform "${spec.transform}"`,
        });
      }
    }
  }

  // 规则 2 + 规则 6
  for (const op of operations) {
    if (!preset.endpoints[op]) {
      violations.push({
        code: 'OPERATION_NOT_IMPLEMENTED',
        message: `metadata.operations declares "${op}" but preset "${preset.key}" has no endpoints.${op}`,
      });
    }
    const core = preset.coreBindings[op];
    if (!core) {
      violations.push({
        code: 'MISSING_CORE_BINDING',
        message: `preset "${preset.key}" has no coreBindings.${op}`,
      });
      continue;
    }
    if (op === 'edit' && !core.inputImages) {
      violations.push({
        code: 'MISSING_CORE_BINDING',
        message: `preset "${preset.key}" coreBindings.edit is missing the inputImages binding`,
      });
    }
  }
  if (operations.includes('edit') && !properties.referenceImages) {
    violations.push({
      code: 'EDIT_NEEDS_REFERENCE_IMAGES',
      message: 'metadata.operations includes "edit" but paramsSchema has no referenceImages property',
    });
  }

  // 规则 7：token 可解析性 —— 每一个，不是「大多数」
  for (const [name, property] of Object.entries(properties)) {
    const derivedFrom = property['x-ui']?.derivedFrom;
    if (!derivedFrom) continue;
    const canParse = CAN_PARSE[derivedFrom.via];
    if (!canParse) continue;   // 未知 via 由 validateParamsSchema 拦（UNKNOWN_DERIVE_FN）
    const source = properties[derivedFrom.param];
    for (const token of source?.enum ?? []) {
      if (!canParse(String(token))) {
        violations.push({
          code: 'UNPARSEABLE_SOURCE_TOKEN', param: derivedFrom.param,
          message: `"${name}" derives from "${derivedFrom.param}" via ${derivedFrom.via}, but token "${token}" is unparseable — it would silently fall back to a default tier`,
        });
      }
    }
  }

  // 规则 8：复合绑定的查表必须覆盖源参数 enum 的**每一个笛卡尔组合**。
  //
  // 为什么是「每一个」而不是「大多数」：gpt-image 的 size 由 (aspectRatio × resolution)
  // 查表得出。schema 允许用户选 21:9，而 valueMap 里没有 `21:9@4K` —— 结果不是报错，
  // 是这个参数被**静默丢掉**，上游按自己的默认尺寸出图，用户拿到一张比例完全不对的图，
  // 而且按 4K 收了费。这条规则就是在保存期拦住这种 schema 与 preset 的分叉。
  for (const [name, binding] of Object.entries(preset.paramBindings)) {
    if (isStrategy(binding) || Array.isArray(binding) || !binding.composeFrom) continue;
    if (!binding.valueMap) continue; // 无查表 = 直接拼出来的字符串就是要发的值

    const enums = binding.composeFrom.map((source) => {
      const values = properties[source]?.enum;
      return (values ?? []).map(String);
    });
    if (enums.some((values) => values.length === 0)) continue; // 源参数不存在/无 enum：由规则 1b 兜

    const join = binding.join ?? '@';
    const keys = enums.reduce<string[]>(
      (acc, values) => acc.flatMap((prefix) => values.map((value) => (prefix ? `${prefix}${join}${value}` : value))),
      [''],
    );
    for (const key of keys) {
      if (binding.valueMap[key] === undefined) {
        violations.push({
          code: 'COMPOSED_BINDING_MISSING_COMBO', param: name,
          message: `preset "${preset.key}" composes "${name}" from [${binding.composeFrom.join(', ')}], but its valueMap has no entry for "${key}" — that combination is selectable in this model's schema and would be silently dropped`,
        });
      }
    }
  }

  // 规则 9：产出像素尺寸的复合绑定，valueMap 的每个值都必须满足上游声明的尺寸约束。
  //
  // 规则 8 只保证「schema 的每个组合在表里都有条目」——但**条目的值**仍可能是上游根本
  // 不接受的尺寸：4096x4096（超边 3840 + 超像素上限）、2048x1365（边非 16 的倍数）、
  // 3840x2560（像素 9.83M 超 8.29M 上限）。这类值不会被静默丢，而是原样发出去，在运行期
  // 变成**偶发** 400（同一比例换个档位就时好时坏）。这条规则在保存期把它拦成红灯。
  for (const [name, binding] of Object.entries(preset.paramBindings)) {
    if (isStrategy(binding) || Array.isArray(binding)) continue;
    const constraints = binding.pixelSizeConstraints;
    if (!constraints || !binding.valueMap) continue;
    for (const [combo, value] of Object.entries(binding.valueMap)) {
      const problem = checkPixelSize(value, constraints);
      if (problem) {
        violations.push({
          code: 'COMPOSED_SIZE_ILLEGAL', param: name,
          message: `preset "${preset.key}" composes "${name}", but valueMap["${combo}"] = "${value}" violates the upstream size contract: ${problem}`,
        });
      }
    }
  }

  const rm = preset.referenceMode;
  const uploadMax =
    (properties.referenceImages as { 'x-ui'?: { uploadMax?: number } } | undefined)?.['x-ui']?.uploadMax ?? 0;

  // (1) edit-multipart preset 允许上传参考图 ⟹ operations 必含 edit（否则运行期才 fail fast）
  if (rm?.kind === 'edit-multipart' && uploadMax > 0 && !operations.includes('edit')) {
    violations.push({
      code: 'EDIT_MULTIPART_NEEDS_EDIT_OP',
      message: `edit-multipart preset "${preset.key}" allows reference upload (uploadMax=${uploadMax}) but metadata.operations lacks "edit"`,
    });
  }
  // (2) generate-json-url preset ⟹ paramsSchema 须有 referenceImages
  if (rm?.kind === 'generate-json-url' && !properties.referenceImages) {
    violations.push({
      code: 'GENERATE_JSON_URL_NEEDS_REFERENCE_IMAGES',
      message: `generate-json-url preset "${preset.key}" needs a referenceImages property in paramsSchema`,
    });
  }
  // (3) uploadMax 不得超过 referenceMode.maxImages（允许收紧，不要求相等）
  if (rm?.kind === 'generate-json-url' && rm.maxImages != null && uploadMax > rm.maxImages) {
    violations.push({
      code: 'UPLOAD_MAX_EXCEEDS_MODE_MAX',
      message: `referenceImages.x-ui.uploadMax=${uploadMax} exceeds referenceMode.maxImages=${rm.maxImages} for "${preset.key}"`,
    });
  }

  return violations;
}
