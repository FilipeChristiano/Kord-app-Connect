# Build context MUST be the repo root (monorepo pnpm workspace), e.g.:
#   docker build -f artifacts/api-server/Dockerfile \
#     -t registry.connectprojetosesistemas.com.br/kordi-backend:latest .
#
# Imagem fica grande (torch CPU + demucs + librosa ~1.5-2GB) — isso é esperado,
# é o preço da separação de voz/instrumental e detecção de acordes em áudio.

FROM node:24-bookworm-slim AS node-builder
RUN npm install -g pnpm@12.9.1
WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile --filter "@workspace/api-server..."
RUN pnpm --filter "@workspace/api-server" run build

FROM python:3.11-slim-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      libsndfile1 \
      ca-certificates \
      curl \
      gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app
COPY --from=node-builder /app /app

# Cria o venv Python (torch cpu, demucs, librosa, yt-dlp, ...) a partir do
# uv.lock da raiz do monorepo — reprodutível, sem puxar a cadeia CUDA.
RUN uv sync --frozen --no-install-project

ENV PATH="/app/.venv/bin:${PATH}" \
    CHORD_PYTHON="/app/.venv/bin/python3" \
    NODE_ENV=production

WORKDIR /app/artifacts/api-server
EXPOSE 3001

CMD ["node", "dist/index.cjs"]
