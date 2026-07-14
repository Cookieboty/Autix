// Re-export ImageOperation from domain
export type { ImageOperation } from '@autix/domain/model';

/** Valid transform function names */
export type TransformKey = 'stripTierSuffix';

/** Error classification for upstream errors */
export type ErrorClassification = 'invalid_request' | 'rate_limit' | 'server_error' | 'auth_error' | 'unknown';

/**
 * Upstream error with diagnostics.
 * message: English diagnostic string (for logs)
 * User-facing text decided by api-service i18n.
 */
export class ImageUpstreamError extends Error {
  readonly classification: ErrorClassification;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly upstreamBody?: string;

  constructor(init: {
    message: string;
    classification: ErrorClassification;
    httpStatus?: number;
    retryable: boolean;
    upstreamBody?: string;
  }) {
    super(init.message);
    this.name = 'ImageUpstreamError';
    this.classification = init.classification;
    this.httpStatus = init.httpStatus;
    this.retryable = init.retryable;
    this.upstreamBody = init.upstreamBody;
  }
}

/** Protocol preset for an adapter */
export interface ProtocolPreset {
  readonly id: string;
  readonly bindings: Record<string, BindingSpec>;
}

/** Binding specification for a preset parameter */
export interface BindingSpec {
  readonly path: string;
  readonly transform?: TransformKey;
}

/** Image generation/edit request */
export interface ImageCallRequest {
  readonly operation: 'generate' | 'edit';
  readonly params: Record<string, unknown>;
}

/** Image generation/edit result */
export interface ImageCallResult {
  readonly images?: ImageArtifact[];
  readonly error?: ImageUpstreamError;
}

/** Generated or edited image artifact */
export interface ImageArtifact {
  readonly data?: string;
  readonly mimeType?: string;
}
