# Build context MUST be the repo root (monorepo pnpm workspace), e.g.:
#   docker build -f artifacts/acordes/Dockerfile \
#     --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx \
#     -t registry.connectprojetosesistemas.com.br/kordi-frontend:latest .
#
# VITE_CLERK_PUBLISHABLE_KEY é embutida no bundle em BUILD TIME (Vite) — não
# tem como setar isso depois via variável de ambiente no container/Portainer.
# Se a chave do Clerk mudar, é preciso rebuildar e repushar a imagem.

FROM node:24-bookworm-slim AS builder
RUN npm install -g pnpm@12.9.1
WORKDIR /app

COPY . .

ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_PROXY_URL=""
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY} \
    VITE_CLERK_PROXY_URL=${VITE_CLERK_PROXY_URL} \
    NODE_ENV=production

RUN pnpm install --frozen-lockfile --filter "@workspace/acordes..."
RUN pnpm --filter "@workspace/acordes" run build

FROM nginx:1.27-alpine AS runtime
COPY artifacts/acordes/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/artifacts/acordes/dist/public /usr/share/nginx/html

EXPOSE 80
