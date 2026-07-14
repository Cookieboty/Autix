import type { ImageOperation } from '@autix/domain/model';

// Re-export ImageOperation from domain
export type { ImageOperation } from '@autix/domain/model';

/** Wire transport shape for a protocol preset */
export type Transport = 'sync-json' | 'multipart' | 'async-poll' | 'sse';

/** Error classification for upstream errors */
export type ErrorClassification =
  | 'params'
  | 'auth'
  | 'rate-limit'
  | 'content-policy'
  | 'timeout'
  | 'upstream';

/** Valid transform function names */
export type TransformKey = 'stripTierSuffix';

/** Binding specification for a preset parameter */
export interface BindingSpec {
  path: string; // 'size' | 'generationConfig.seed' | '$url.model'
  valueMap?: Record<string, string>;
  transform?: TransformKey;
  omitWhen?: 'empty';
}

/** How a plain param binds into the request: either a path write, or a strategy */
export type ParamStrategy =
  | { strategy: 'prompt-inject'; template: string } // '{{value}}' 占位
  | { strategy: 'ignore' };

/** How the requested image count binds into the request */
export type CountBinding = BindingSpec | { strategy: 'fan-out'; maxConcurrency: number };

/** HTTP endpoint for an operation */
export interface EndpointSpec {
  method: 'POST';
  path: string;
}

/** Multipart upload shape */
export interface MultipartSpec {
  imageField: string;
  indexBase: 0 | 1;
  filenamePattern: string;
  maskField?: string;
}

/** How to read images and metadata out of the upstream response */
export interface ResponseSpec {
  itemsPath: string; // 'data[*]' | 'candidates[*].content.parts[*]'
  b64Field?: string;
  urlField?: string;
  mimeField?: string;
  defaultMime: string;
  seedField?: string;
  revisedPromptField?: string;
}

/** Protocol preset for an adapter */
export interface ProtocolPreset {
  key: string;
  transport: Transport;
  timeoutMs: number;
  auth: { in: 'header' | 'query'; name: string; template: string }; // 'Bearer {apiKey}'
  endpoints: Partial<Record<ImageOperation, EndpointSpec>>;
  coreBindings: Partial<
    Record<
      ImageOperation,
      {
        model: BindingSpec;
        prompt: BindingSpec;
        count: CountBinding;
        inputImages?: BindingSpec;
      }
    >
  >;
  paramBindings: Record<string, BindingSpec | BindingSpec[] | ParamStrategy>;
  staticBody?: Record<string, unknown>;
  multipart?: MultipartSpec;
  response: ResponseSpec;
  errorMapping: Record<string, ErrorClassification>; // '400' | '*'
}

/** Image generation/edit request */
export interface ImageCallRequest {
  preset: ProtocolPreset;
  operation: ImageOperation;
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  count: number;
  /** 已经过 role 投影的 wire 子集。引擎不认识 role。 */
  params: Record<string, unknown>;
  sourceImages?: Array<{ url: string }>;
  referenceImages?: Array<{ url: string }>;
  maskUrl?: string;
}

/** Generated or edited image artifact */
export interface ImageArtifact {
  source:
    | { type: 'base64'; data: string; mimeType: string }
    | { type: 'url'; url: string; mimeType?: string };
  index: number;
  seed?: string;
  revisedPrompt?: string;
}

/** Image generation/edit result */
export interface ImageCallResult {
  artifacts: ImageArtifact[];
  applied: { params: Record<string, unknown>; coercions: string[] };
  upstream: {
    protocolKey: string;
    endpoint: string;
    httpStatus: number;
    requestId?: string;
    durationMs: number;
  };
  warnings: string[];
}
