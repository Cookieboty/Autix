import { safeFetch } from '../../core/safe-fetch';
import { assembleVideoRequest } from './assemble';
import { normalizeVideoOutcome, readPath } from './result';
import { VideoUpstreamError } from './types';
import type {
  ErrorClassification,
  VideoCallRequest,
  VideoProtocolPreset,
  VideoTaskOutcome,
} from './types';

const RETRYABLE: ReadonlySet<ErrorClassification> = new Set(['rate-limit', 'timeout', 'upstream']);
/** 上游错误原文只截断进日志，不进 UI。 */
const UPSTREAM_BODY_LIMIT = 2000;

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function authHeaders(preset: VideoProtocolPreset, apiKey: string): Record<string, string> {
  if (preset.auth.in !== 'header') return {};
  return { [preset.auth.name]: preset.auth.template.replace('{apiKey}', apiKey) };
}

function classify(preset: VideoProtocolPreset, status: number): ErrorClassification {
  return preset.errorMapping[String(status)] ?? preset.errorMapping['*'] ?? 'upstream';
}

async function callUpstream(
  preset: VideoProtocolPreset,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  // 走 safeFetch 而非裸 fetch：baseUrl 来自 DB 的 model_configs，一条被篡改或误配的
  // 记录可让服务端打内网。safeFetch 含私网拦截 + 每跳重定向复检。
  const res = await safeFetch(url, init, { timeoutMs: preset.timeoutMs });
  if (!res.ok) {
    const classification = classify(preset, res.status);
    const body = await res.text().catch(() => '');
    throw new VideoUpstreamError({
      // 只放英文诊断串。**不写死中文文案** —— 用户文案由 api-service 的 i18n 决定。
      message: `upstream video call failed with ${res.status}`,
      classification,
      httpStatus: res.status,
      retryable: RETRYABLE.has(classification),
      upstreamBody: body.slice(0, UPSTREAM_BODY_LIMIT),
      endpoint: url,
      requestId: res.headers.get('x-request-id') ?? undefined,
    });
  }
  return res.json();
}

/** 提交生成任务，返回上游的任务 id。 */
export async function submitVideoTask(req: VideoCallRequest): Promise<{ providerTaskId: string }> {
  const { preset } = req;
  const url = buildUrl(req.baseUrl, preset.submit.endpoint.path);
  const payload = await callUpstream(preset, url, {
    method: preset.submit.endpoint.method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(preset, req.apiKey) },
    body: JSON.stringify(assembleVideoRequest(req)),
  });

  const taskId = readPath(payload, preset.submit.taskIdPath);
  if (typeof taskId !== 'string' || !taskId) {
    throw new VideoUpstreamError({
      message: 'upstream video submit returned no task id',
      classification: 'upstream',
      retryable: false,
      endpoint: url,
    });
  }
  return { providerTaskId: taskId };
}

/** 查询任务状态，返回归一化终态。 */
export async function queryVideoTask(args: {
  preset: VideoProtocolPreset;
  baseUrl: string;
  apiKey: string;
  taskId: string;
  onWarn?: (message: string) => void;
}): Promise<VideoTaskOutcome> {
  const { preset } = args;
  const url = buildUrl(
    args.baseUrl,
    preset.query.endpoint.path.replace('{taskId}', encodeURIComponent(args.taskId)),
  );
  const payload = await callUpstream(preset, url, {
    method: preset.query.endpoint.method,
    headers: authHeaders(preset, args.apiKey),
  });
  return normalizeVideoOutcome(preset.result, payload, args.onWarn);
}
