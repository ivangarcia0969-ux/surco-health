# =====================================================
# apps/api/Dockerfile — Surco Health API
# Build context: repo root
# =====================================================

FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---- deps ----------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/encryption/package.json ./packages/encryption/
COPY packages/audit/package.json ./packages/audit/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile \
    --filter @surco/api... \
    --filter @surco/db \
    --filter @surco/shared \
    --filter @surco/encryption \
    --filter @surco/audit

# ---- builder -------------------------------------------------
FROM base AS builder
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/packages/encryption/node_modules ./packages/encryption/node_modules
COPY --from=deps /repo/packages/audit/node_modules ./packages/audit/node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @surco/db exec prisma generate
RUN pnpm --filter @surco/shared build \
 && pnpm --filter @surco/db build \
 && pnpm --filter @surco/encryption build \
 && pnpm --filter @surco/audit build \
 && pnpm --filter @surco/api build

# ---- runtime -------------------------------------------------
FROM node:20-bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
ENV NODE_ENV=production

# node_modules de los workspaces (con symlinks pnpm)
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /repo/packages/encryption/node_modules ./packages/encryption/node_modules
COPY --from=builder /repo/packages/audit/node_modules ./packages/audit/node_modules
COPY --from=builder /repo/apps/api/node_modules ./apps/api/node_modules

# dist + sources + package.json de cada workspace
COPY --from=builder /repo/packages/db/dist ./packages/db/dist
COPY --from=builder /repo/packages/db/src ./packages/db/src
COPY --from=builder /repo/packages/db/prisma ./packages/db/prisma
COPY --from=builder /repo/packages/db/package.json ./packages/db/package.json
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/packages/shared/src ./packages/shared/src
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /repo/packages/encryption/dist ./packages/encryption/dist
COPY --from=builder /repo/packages/encryption/src ./packages/encryption/src
COPY --from=builder /repo/packages/encryption/package.json ./packages/encryption/package.json
COPY --from=builder /repo/packages/audit/dist ./packages/audit/dist
COPY --from=builder /repo/packages/audit/src ./packages/audit/src
COPY --from=builder /repo/packages/audit/package.json ./packages/audit/package.json
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json

COPY pnpm-workspace.yaml package.json ./

WORKDIR /repo/apps/api
EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
