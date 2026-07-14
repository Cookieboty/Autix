import { buildEndpoint } from '../../core/http';
import { setPath } from './bind';
import { TRANSFORMS } from './transforms';
import type {
  BindingSpec, ImageCallRequest, ParamStrategy, ProtocolPreset,
} from './types';

export interface AssembledRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body?: Record<string, unknown>;
  multipart?: {
    fields: Record<string, string>;
    images: Array<{ url: string; field: string; filename: string }>;
    maskUrl?: string;
  };
  applied: { params: Record<string, unknown>; coercions: string[] };
  promptOverride?: string;
  fanOut?: { count: number; maxConcurrency: number };
}

function isStrategy(b: unknown): b is ParamStrategy {
  return typeof b === 'object' && b !== null && 'strategy' in b;
}

function resolveValue(spec: BindingSpec, raw: unknown): unknown {
  let value = raw;
  if (spec.valueMap && typeof value === 'string') value = spec.valueMap[value] ?? value;
  if (spec.transform) value = TRANSFORMS[spec.transform](value);
  return value;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function assembleImageRequest(req: ImageCallRequest): AssembledRequest {
  const { preset, operation } = req;
  const endpoint = preset.endpoints[operation];
  if (!endpoint) {
    throw new Error(`Preset "${preset.key}" does not implement operation "${operation}"`);
  }
  const core = preset.coreBindings[operation];
  if (!core) {
    throw new Error(`Preset "${preset.key}" has no coreBindings for operation "${operation}"`);
  }

  const body: Record<string, unknown> = { ...(preset.staticBody ?? {}) };
  const applied: Record<string, unknown> = {};
  const coercions: string[] = [];

  // ① prompt-inject 先跑：它改的是 prompt 本身，core 的 prompt 绑定要写改写后的值
  let prompt = req.prompt;
  for (const [name, binding] of Object.entries(preset.paramBindings)) {
    if (!isStrategy(binding) || binding.strategy !== 'prompt-inject') continue;
    const raw = req.params[name];
    if (isEmpty(raw)) continue;
    prompt = `${prompt}\n${binding.template.replace('{{value}}', String(raw))}`;
    applied[name] = raw;
  }

  // ② core bindings
  if (core.model.path !== '$url.model') setPath(body, core.model.path, req.model);
  setPath(body, core.prompt.path, prompt);

  let fanOut: AssembledRequest['fanOut'];
  if ('strategy' in core.count) {
    fanOut = { count: req.count, maxConcurrency: core.count.maxConcurrency };
  } else {
    setPath(body, core.count.path, req.count);
  }

  // ③ param bindings —— 双向闭合由跨配置校验器保证（Task 7）；这里对无绑定的参数记 coercion
  for (const [name, raw] of Object.entries(req.params)) {
    const binding = preset.paramBindings[name];
    if (binding === undefined) {
      coercions.push(`param "${name}" has no binding in preset "${preset.key}" — dropped`);
      continue;
    }
    if (isStrategy(binding)) continue;   // prompt-inject 已处理；ignore 是显式丢弃
    if (!Array.isArray(binding)) {
      // 单路径绑定：applied[name] 就是这个标量本身（今天所有已存在的 preset 都走这条路）。
      const value = resolveValue(binding, raw);
      if (binding.omitWhen === 'empty' && isEmpty(value)) continue;
      setPath(body, binding.path, value);
      applied[name] = value;
      continue;
    }
    // 数组绑定：一个参数写往多条上游路径，每条路径可能有各自的 valueMap/transform、
    // 解析出不同的值——没有单一标量能诚实代表"这个参数被发到了几个不同字段、且值不同"
    // 这件事，所以这里记 Record<path, resolvedValue>（§4.4：applied 必须等于真正发出去的值）。
    // 被 omitWhen:'empty' 跳过的路径不计入；若这个参数的所有路径都被跳过，则它完全不出现在 applied 里。
    const perPath: Record<string, unknown> = {};
    for (const spec of binding) {
      const value = resolveValue(spec, raw);
      if (spec.omitWhen === 'empty' && isEmpty(value)) continue;
      setPath(body, spec.path, value);
      perPath[spec.path] = value;
    }
    if (Object.keys(perPath).length > 0) applied[name] = perPath;
  }

  const url = buildEndpoint(req.baseUrl, endpoint.path.replace('{model}', req.model));
  const headers: Record<string, string> = {};
  if (preset.auth.in === 'header') {
    headers[preset.auth.name] = preset.auth.template.replace('{apiKey}', req.apiKey);
  }

  // 约定：`ProtocolPreset.transport` 描述的是 "generate" 这个主操作的传输形态，preset
  // 本身没有按 operation 分别声明 transport 的字段（YAGNI——现在没有 generate 本身就是
  // multipart 的协议）。因此 `edit` 是否走 multipart，不看 `transport`，而看这个 preset
  // 是否声明了 `multipart` spec：带 `multipart` spec 的 preset，其 `edit` 操作总是走
  // multipart 分支，即便 `transport` 写的是 'sync-json'（那描述的是 generate）。
  // 若将来出现 generate 本身也是 multipart 的协议，再把 `transport` 下放到
  // `EndpointSpec`——现在不做。
  if (preset.transport === 'multipart' || (operation === 'edit' && preset.multipart)) {
    const mp = preset.multipart;
    if (!mp) throw new Error(`Preset "${preset.key}" is multipart but has no multipart spec`);
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!isEmpty(v)) fields[k] = String(v);
    }
    const inputs = [...(req.sourceImages ?? []), ...(req.referenceImages ?? [])];
    const images = inputs.map((input, i) => {
      const n = i + mp.indexBase;
      return {
        url: input.url,
        field: i === 0 ? mp.imageField : `${mp.imageField}_${n}`,
        filename: mp.filenamePattern.replace('{i}', String(n)),
      };
    });
    return {
      url, method: 'POST', headers,
      multipart: { fields, images, maskUrl: req.maskUrl },
      applied: { params: applied, coercions },
      promptOverride: prompt === req.prompt ? undefined : prompt,
      fanOut,
    };
  }

  headers['Content-Type'] = 'application/json';
  return {
    url, method: 'POST', headers, body,
    applied: { params: applied, coercions },
    promptOverride: prompt === req.prompt ? undefined : prompt,
    fanOut,
  };
}
