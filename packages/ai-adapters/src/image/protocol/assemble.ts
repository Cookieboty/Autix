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
    const specs = Array.isArray(binding) ? binding : [binding];
    for (const spec of specs) {
      const value = resolveValue(spec, raw);
      if (spec.omitWhen === 'empty' && isEmpty(value)) continue;
      setPath(body, spec.path, value);
      applied[name] = value;
    }
  }

  const url = buildEndpoint(req.baseUrl, endpoint.path.replace('{model}', req.model));
  const headers: Record<string, string> = {};
  if (preset.auth.in === 'header') {
    headers[preset.auth.name] = preset.auth.template.replace('{apiKey}', req.apiKey);
  }

  // 约定：`ProtocolPreset.transport` 是整个 preset 对象的单一传输形态标记，本意是描述
  // "generate" 这个主操作的传输形态。带 `multipart` spec 的 preset，其 `edit` 操作总是走
  // multipart 分支——这是通过把这类 preset 的 transport 直接设为 'multipart' 来体现的
  // （而不是按 operation 分别声明 transport）。因此若某家族 generate 走 sync-json、edit
  // 走 multipart（如上传原图），需要拆成两个 preset 对象，各自的 transport 描述自己的形态；
  // 不能指望同一个 preset 对同一份 transport 字段在不同 operation 下有不同解读。
  if (preset.transport === 'multipart') {
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
