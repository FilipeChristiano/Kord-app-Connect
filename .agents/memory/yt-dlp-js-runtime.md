---
name: yt-dlp exige runtime JS (node)
description: Extração do YouTube via yt-dlp precisa de --js-runtimes node neste ambiente
---

Regra: toda invocação de yt-dlp para YouTube deve incluir `--js-runtimes node`.

**Why:** desde ~2026 o YouTube exige um runtime JavaScript para extração (EJS).
O padrão do yt-dlp habilita só o deno, que NÃO existe no ambiente Replit
(dev nem produção) — sem a flag, tudo falha com "No supported JavaScript
runtime could be found" (visto quebrando a mesa de mistura em produção).
Node está sempre presente (é o runtime do api-server).

**How to apply:** ao adicionar qualquer novo uso de yt-dlp (rotas, scripts),
incluir `--js-runtimes node` nos args. Erros 403 esporádicos do YouTube são
transitórios — repetir antes de investigar.
