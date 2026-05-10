FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY shared ./shared
COPY services/api-gateway ./services/api-gateway
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
RUN pnpm --filter @apna/api-gateway... build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 8080
CMD ["node", "services/api-gateway/dist/server.js"]
