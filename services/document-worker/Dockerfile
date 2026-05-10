# Build stage
FROM node:22-alpine AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/document-worker ./services/document-worker
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @apna/document-worker... build

# Runtime stage - needs LibreOffice, so use bookworm-slim
FROM node:22-bookworm-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
  libreoffice \
  ghostscript \
  tesseract-ocr \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/services/document-worker ./services/document-worker
CMD ["node", "services/document-worker/dist/worker.js"]
