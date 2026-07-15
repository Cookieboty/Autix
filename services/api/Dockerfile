# syntax=docker/dockerfile:1

FROM node:22-slim AS builder
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/ai-adapters/package.json packages/ai-adapters/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/i18n/package.json packages/i18n/
COPY packages/platform/package.json packages/platform/
COPY packages/sdk/package.json packages/sdk/
COPY packages/shared-store/package.json packages/shared-store/
COPY packages/shared-ui/package.json packages/shared-ui/
COPY services/api/package.json services/api/
COPY clients/web/package.json clients/web/
COPY clients/desktop/package.json clients/desktop/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.base.json turbo.json ./
COPY packages/ packages/
COPY services/api/ services/api/

RUN pnpm --filter @autix/i18n build
RUN pnpm --filter @autix/domain build
RUN pnpm --filter @autix/database build
RUN pnpm --filter @autix/ai-adapters build

# nest 现在用 SWC 编译（typeCheck: false），只转译不校验类型 —— 以前 tsc 构建时会拦住
# 类型错误，现在不会。这一步把那道闸门放回来：镜像构建通过 ⇒ 类型是干净的。
RUN pnpm --filter @autix/api run typecheck
RUN pnpm --filter @autix/api run build

# --- Production dependencies (API + its workspace closure only) ---
# `--filter @autix/api...` installs the API and everything it depends on, so the
# web/desktop trees (Next, Electron) never land here.
FROM node:22-slim AS prod-deps
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/ai-adapters/package.json packages/ai-adapters/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/i18n/package.json packages/i18n/
COPY packages/platform/package.json packages/platform/
COPY packages/sdk/package.json packages/sdk/
COPY packages/shared-store/package.json packages/shared-store/
COPY packages/shared-ui/package.json packages/shared-ui/
COPY services/api/package.json services/api/
COPY clients/web/package.json clients/web/
COPY clients/desktop/package.json clients/desktop/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @autix/api...

# --- Runtime ---
FROM node:22-slim
RUN corepack enable pnpm && \
    apt-get update && \
    apt-get install -y --no-install-recommends wget curl openssl && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./

COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/database/prisma.config.ts ./packages/database/prisma.config.ts
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/database/scripts ./packages/database/scripts
COPY --from=prod-deps /app/packages/database/node_modules ./packages/database/node_modules

COPY --from=builder /app/packages/domain/package.json ./packages/domain/package.json
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/packages/i18n/package.json ./packages/i18n/package.json
COPY --from=builder /app/packages/i18n/dist ./packages/i18n/dist
COPY --from=builder /app/packages/ai-adapters/package.json ./packages/ai-adapters/package.json
COPY --from=builder /app/packages/ai-adapters/dist ./packages/ai-adapters/dist

COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/scripts ./services/api/scripts
COPY --from=builder /app/services/api/package.json ./services/api/package.json
COPY --from=prod-deps /app/services/api/node_modules ./services/api/node_modules

# Workspace packages: ensure node_modules links point to actual dist content
RUN mkdir -p node_modules/@autix && \
    rm -rf node_modules/@autix/domain node_modules/@autix/i18n node_modules/@autix/ai-adapters node_modules/@autix/database && \
    ln -s /app/packages/domain node_modules/@autix/domain && \
    ln -s /app/packages/i18n node_modules/@autix/i18n && \
    ln -s /app/packages/ai-adapters node_modules/@autix/ai-adapters && \
    ln -s /app/packages/database node_modules/@autix/database

# The CMD runs `db:prepare-cutover`, whose steps shell out to prisma, tsx and
# dotenv — all devDependencies, which `--prod` above excludes. Install them
# explicitly here, or the migration chain dies at container start.
#
# The prisma CLI version is derived from the @prisma/client actually installed:
# Prisma refuses to run when the two drift, and hardcoding a version here would
# silently rot the moment the lockfile resolves a new patch.
RUN PRISMA_VERSION="$(node -p "require('/app/packages/database/node_modules/@prisma/client/package.json').version")" && \
    TSX_VERSION="$(node -p "require('/app/package.json').devDependencies.tsx")" && \
    DOTENV_VERSION="$(node -p "require('/app/package.json').devDependencies['dotenv-cli']")" && \
    pnpm add -g "prisma@${PRISMA_VERSION}" "tsx@${TSX_VERSION}" "dotenv-cli@${DOTENV_VERSION}"

ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
WORKDIR /app/services/api
RUN echo '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./dist/*"]}}}' > tsconfig.json
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:4000/api/auth/health || exit 1

CMD ["sh", "-c", "cd /app/packages/database && pnpm run db:prepare-cutover && cd /app/services/api && node dist/main.js"]
