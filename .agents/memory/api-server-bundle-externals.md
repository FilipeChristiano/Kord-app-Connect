---
name: api-server esbuild externals
description: Deps do api-server precisam estar declaradas no package.json dele, senão o esbuild as embute no bundle CJS e pode quebrar em produção.
---

# Regra
Toda dependência importada pelo `artifacts/api-server` deve estar em `dependencies` do **próprio** `artifacts/api-server/package.json` — nunca confiar em hoisting da raiz do monorepo.

**Why:** o build de produção (esbuild, formato CJS, minificado) marca como `external` apenas as deps declaradas no package.json do api-server que não estão na allowlist. Uma dep importada mas não declarada (resolvida por hoisting da raiz) é **embutida no bundle** — se ela for ESM e usar `import.meta.url` (ex.: pacotes que leem arquivos do disco, como migrations SQL), o bundle CJS crasha no start com `fileURLToPath(undefined)` (node:internal/url). Isso passou no Build do deploy e só quebrou no Promote (healthcheck), com log de erro quase invisível.

**How to apply:** ao adicionar qualquer import novo no api-server, `pnpm add` no pacote api-server (não na raiz). Para validar o bundle de produção, rodar `node artifacts/api-server/dist/index.cjs` localmente com PORT setado — reproduz crashes de bundling que o dev (tsx) não pega.
