# Shared image for the three Node services. Select one with `--build-arg APP=api|smtp-ingress|worker`.
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/smtp-ingress/package.json apps/smtp-ingress/
COPY apps/worker/package.json apps/worker/
COPY apps/dashboard/package.json apps/dashboard/
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm run build \
  && npm prune --omit=dev

FROM base AS runtime
ARG APP
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/${APP}/dist ./apps/${APP}/dist
COPY --from=build /app/apps/${APP}/package.json ./apps/${APP}/package.json
WORKDIR /app/apps/${APP}
USER node
CMD ["node", "dist/index.js"]
