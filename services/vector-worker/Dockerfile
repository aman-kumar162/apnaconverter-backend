# Build stage
FROM node:22-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/vector-worker ./services/vector-worker
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @apna/vector-worker... build

# Runtime stage
FROM node:22-bookworm-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
  inkscape \
  imagemagick \
  ghostscript \
  python3-minimal \
  python3-pip \
  && pip3 install --no-cache-dir uniconvertor \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/vector-worker ./services/vector-worker
CMD ["node", "services/vector-worker/dist/worker.js"]
