# syntax=docker/dockerfile:1

FROM oven/bun:1.3.11 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/ai-adapters/package.json packages/ai-adapters/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/i18n/package.json packages/i18n/
COPY packages/shared-lib/package.json packages/shared-lib/
COPY packages/shared-store/package.json packages/shared-store/
COPY packages/shared-ui/package.json packages/shared-ui/
COPY services/api/package.json services/api/
COPY clients/web/package.json clients/web/
COPY clients/desktop/package.json clients/desktop/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY tsconfig.base.json turbo.json ./
COPY packages/ packages/
COPY services/api/ services/api/

RUN cd packages/types && bun run build
RUN cd packages/i18n && bun run build
RUN cd packages/database && bun run build
RUN cd packages/ai-adapters && bun run build
RUN cd services/api && rm -rf dist tsconfig.tsbuildinfo && bunx nest build

# --- Production dependencies (API-only) ---
FROM oven/bun:1.3.11 AS prod-deps
WORKDIR /app

COPY package.json ./

# API and its workspace deps — real package.json
COPY packages/ai-adapters/package.json packages/ai-adapters/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/i18n/package.json packages/i18n/
COPY services/api/package.json services/api/

# Workspaces the API doesn't need — empty stubs to satisfy workspace globs
RUN mkdir -p packages/shared-lib packages/shared-store packages/shared-ui clients/web clients/desktop && \
    echo '{"name":"@autix/shared-lib","private":true}' > packages/shared-lib/package.json && \
    echo '{"name":"@autix/shared-store","private":true}' > packages/shared-store/package.json && \
    echo '{"name":"@autix/shared-ui","private":true}' > packages/shared-ui/package.json && \
    echo '{"name":"@autix/web","private":true}' > clients/web/package.json && \
    echo '{"name":"@autix/desktop","private":true}' > clients/desktop/package.json

# No lockfile — stubs change the dep tree, fresh resolve is intentional
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --production && \
    cd packages/database && bun add prisma

# --- Runtime ---
FROM oven/bun:1.3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends wget curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./

COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/database/prisma.config.ts ./packages/database/prisma.config.ts
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/database/scripts ./packages/database/scripts
COPY --from=prod-deps /app/packages/database/node_modules ./packages/database/node_modules

COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/i18n/package.json ./packages/i18n/package.json
COPY --from=builder /app/packages/i18n/dist ./packages/i18n/dist
COPY --from=builder /app/packages/ai-adapters/package.json ./packages/ai-adapters/package.json
COPY --from=builder /app/packages/ai-adapters/dist ./packages/ai-adapters/dist

COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/package.json ./services/api/package.json
COPY --from=prod-deps /app/services/api/node_modules ./services/api/node_modules

ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
WORKDIR /app/services/api
RUN echo '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./dist/*"]}}}' > tsconfig.json
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:4000/api/auth/health || exit 1

CMD ["sh", "-c", "cd /app/packages/database && bun run db:prepare-cutover && cd /app/services/api && bun run dist/main.js"]
