/**
 * Typed errors emitted by image adapters.
 *
 * These are caught by the caller's service layer to translate
 * upstream parameter problems into a stable Chinese error code and an optional
 * safe-default retry. Adapter code MUST throw these — never bare `Error` —
 * whenever it knows the failure is caused by bad request params, so the service
 * layer can distinguish "user param fixable" from "real upstream outage".
 */

/** Code reported to the API contract / logger. */
export const UPSTREAM_PARAMS_INVALID = 'UPSTREAM_PARAMS_INVALID' as const;

/**
 * Adapter rejected the request because the supplied params are not legal for
 * the resolved model/kind (e.g. `edit()` invoked on a non-`gpt-image` model,
 * or a value outside the capability whitelist that was somehow not coerced
 * upstream).
 */
export class UpstreamParamsInvalidError extends Error {
  readonly code = UPSTREAM_PARAMS_INVALID;
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'UpstreamParamsInvalidError';
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}
