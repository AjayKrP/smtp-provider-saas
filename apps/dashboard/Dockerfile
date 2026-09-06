# Build the SPA and serve it as static files. Build context must be the repo root:
#   docker build -f apps/dashboard/Dockerfile -t smtp-saas-dashboard .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/smtp-ingress/package.json apps/smtp-ingress/
COPY apps/worker/package.json apps/worker/
COPY apps/dashboard/package.json apps/dashboard/
RUN npm ci
COPY tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm run build --workspace apps/dashboard

FROM nginx:1.27-alpine AS runtime
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
