# syntax=docker/dockerfile:1
#
# 共享依赖层（仅用于 CI 缓存预热，不产出运行镜像）。
# 这里的 FROM / COPY / RUN 必须与各服务 Dockerfile 的 install 前缀逐字节一致，
# 否则 buildkit 无法命中缓存。默认使用 alpine 变体（被 user-system / chat-web /
# admin-web 共用）。chat 使用 glibc 基础镜像，不复用此缓存。
ARG BUN_IMAGE=oven/bun:1.3.11-alpine
FROM ${BUN_IMAGE} AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/i18n/package.json packages/i18n/
COPY packages/shared-lib/package.json packages/shared-lib/
COPY packages/shared-store/package.json packages/shared-store/
COPY packages/shared-ui/package.json packages/shared-ui/
COPY services/chat/package.json services/chat/
COPY services/user-system/package.json services/user-system/
COPY clients/chat-web/package.json clients/chat-web/
COPY clients/admin-web/package.json clients/admin-web/
COPY clients/desktop/package.json clients/desktop/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
