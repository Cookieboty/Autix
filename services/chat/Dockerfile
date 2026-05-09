# syntax=docker/dockerfile:1

FROM oven/bun:1.3.11 AS builder
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

COPY tsconfig.base.json turbo.json ./
COPY packages/ packages/
COPY services/chat/ services/chat/

RUN cd packages/types && bun run build
RUN cd packages/i18n && bun run build
RUN cd services/chat && bunx prisma generate
RUN cd services/chat && rm -rf dist tsconfig.tsbuildinfo && bunx nest build

FROM oven/bun:1.3.11
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/i18n/package.json ./packages/i18n/package.json
COPY --from=builder /app/packages/i18n/dist ./packages/i18n/dist

COPY --from=builder /app/services/chat/dist ./services/chat/dist
COPY --from=builder /app/services/chat/package.json ./services/chat/package.json
COPY --from=builder /app/services/chat/prisma.config.ts ./services/chat/prisma.config.ts
COPY --from=builder /app/services/chat/prisma ./services/chat/prisma
COPY --from=builder /app/services/chat/node_modules ./services/chat/node_modules
COPY --from=builder /app/services/chat/src/generated ./services/chat/src/generated
COPY --from=builder /app/services/chat/scripts/seed-system-workflow.ts ./services/chat/scripts/seed-system-workflow.ts

ENV NODE_ENV=production
WORKDIR /app/services/chat
RUN echo '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./dist/*"]}}}' > tsconfig.json
EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:4001/api/health || exit 1

CMD ["sh", "-c", "cd /app/services/chat && bunx prisma migrate deploy && bun run scripts/seed-system-workflow.ts && bun run dist/main.js"]
