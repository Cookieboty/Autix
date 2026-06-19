# @autix/platform

Runtime adapter singleton for Web and Desktop.

Applications register auth, navigation, and environment adapters at bootstrap.
Shared packages consume those adapters through this package instead of touching
localStorage, Electron IPC, or app-specific routers directly.
