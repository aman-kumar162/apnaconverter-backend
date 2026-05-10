# Build stage
FROM node:22-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/image-worker ./services/image-worker
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @apna/image-worker... build

# Runtime stage
FROM node:22-bookworm-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
  libvips \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/image-worker ./services/image-worker
CMD ["node", "services/image-worker/dist/worker.js"]
