# @autix/sdk

Typed API client entrypoint.

The current implementation re-exports the existing `@autix/shared-lib` API
surface in domain-oriented modules. Future API implementations should move here
module by module while keeping the old `@autix/shared-lib` exports as temporary
compatibility shims.
