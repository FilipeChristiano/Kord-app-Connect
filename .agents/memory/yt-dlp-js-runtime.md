---
name: yt-dlp exige runtime JS (node) + solver EJS
description: Extração do YouTube precisa de --js-runtimes node, do pacote yt-dlp-ejs e de fallback de clientes
---

Regras para qualquer uso de yt-dlp com YouTube neste projeto:

1. Sempre passar `--js-runtimes node` (o padrão só habilita deno, que não
   existe no ambiente Replit; node está sempre presente).
2. Instalar via extra `yt-dlp[default]` — isso traz o `yt-dlp-ejs` (solver de
   desafios). Sem ele, clientes alternativos falham com "Signature solving
   failed" / "Requested format is not available".
3. IP de datacenter (app publicado) pode ser barrado com "Sign in to confirm
   you're not a bot". Solução: fallback de clientes em sequência —
   padrão → `youtube:player_client=web_embedded` → `tv`. Em teste, o
   `web_embedded` baixou onde o `tv` falhou.

**Why:** a mesa de mistura quebrou 2x em produção (jul/2026): primeiro por
falta de runtime JS, depois por bot-check no IP publicado. 403/429 esporádicos
são transitórios — retry resolve.

**How to apply:** ver downloadAudio/CLIENT_FALLBACKS na rota de yt-audio do
api-server; novos usos de yt-dlp devem repetir o mesmo padrão. Dependência
fica no pyproject.toml + uv.lock (produção instala a partir deles).
