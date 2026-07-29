export class AdminSystemProfileSyncError extends Error {
  readonly code = 'ADMIN_SYSTEM_PROFILE_SYNC' as const;

  constructor(options: { cause?: unknown } = {}) {
    super('The active system changed, but the refreshed profile could not be loaded', {
      cause: options.cause,
    });
    this.name = 'AdminSystemProfileSyncError';
  }
}
