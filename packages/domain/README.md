# @autix/domain

Shared domain contracts for Autix.

This package is intentionally dependency-light. It should contain stable API
contracts, DTO-like interfaces, business enums, response shapes, and permission
types that are shared by frontend packages and `services/api`.

Do not import runtime packages such as `@autix/sdk`, `@autix/platform`,
`@autix/shared-ui`, `@autix/shared-store`, or app/service code from here.
