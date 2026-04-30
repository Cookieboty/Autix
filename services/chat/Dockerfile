# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/i18n/package.json packages/i18n/
COPY services/chat/package.json services/chat/
COPY services/user-system/package.json services/user-system/
COPY clients/chat-web/package.json clients/chat-web/
COPY clients/admin-web/package.json clients/admin-web/

RUN bun install --frozen-lockfile

COPY tsconfig.base.json turbo.json ./
COPY packages/ packages/
COPY services/chat/ services/chat/

RUN cd packages/types && bun run build
RUN cd packages/i18n && bun run build
RUN cd services/chat && bunx prisma generate
RUN cd services/chat && bun run build

FROM oven/bun:1-alpine
RUN apk add --no-cache ca-certificates
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
COPY --from=builder /app/services/chat/prisma ./services/chat/prisma
COPY --from=builder /app/services/chat/node_modules/.prisma ./services/chat/node_modules/.prisma

ENV NODE_ENV=production
WORKDIR /app/services/chat
EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:4001/api/health || exit 1

CMD ["bun", "run", "dist/main.js"]
