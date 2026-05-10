# Build stage
FROM node:22-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/pdf-worker ./services/pdf-worker
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @apna/pdf-worker... build

# Runtime stage
FROM node:22-bookworm-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
  ghostscript \
  libreoffice \
  poppler-utils \
  qpdf \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/pdf-worker ./services/pdf-worker
CMD ["node", "services/pdf-worker/dist/worker.js"]
