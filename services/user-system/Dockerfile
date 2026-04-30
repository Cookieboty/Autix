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
COPY services/user-system/ services/user-system/

RUN cd packages/types && bun run build
RUN cd packages/i18n && bun run build
RUN cd packages/database && bunx prisma generate
RUN cd services/user-system && bun run build

FROM oven/bun:1-alpine
RUN apk add --no-cache ca-certificates
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/database/src ./packages/database/src
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/i18n/package.json ./packages/i18n/package.json
COPY --from=builder /app/packages/i18n/dist ./packages/i18n/dist

COPY --from=builder /app/services/user-system/dist ./services/user-system/dist
COPY --from=builder /app/services/user-system/package.json ./services/user-system/package.json

ENV NODE_ENV=production
WORKDIR /app/services/user-system
EXPOSE 4002 50051

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:4002/api/auth/health || exit 1

CMD ["bun", "run", "dist/main.js"]
