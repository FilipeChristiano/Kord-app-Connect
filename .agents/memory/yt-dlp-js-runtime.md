---
name: yt-dlp no YouTube — runtime node, solver EJS e PO tokens
description: Requisitos para yt-dlp funcionar em dev e no servidor publicado (IP de datacenter barrado por bot-check)
---

Regras para qualquer uso de yt-dlp com YouTube neste projeto:

1. Sempre passar `--js-runtimes node` (o padrão só habilita deno, que não
   existe no ambiente Replit; node está sempre presente).
2. Instalar via extra `yt-dlp[default]` — traz o `yt-dlp-ejs` (solver de
   desafios). Sem ele, clientes alternativos falham com "Signature solving
   failed" / "Requested format is not available".
3. IP de datacenter (app publicado) é barrado com "Sign in to confirm you're
   not a bot" em TODOS os player_clients. Correção real: PO tokens via plugin
   pip `bgutil-ytdlp-pot-provider` + script bgutil vendorizado (modo script,
   bundlar com esbuild NÃO funciona — jsdom lê assets por __dirname; vendorizar
   o build ESM e colocar as deps no package.json do api-server). Passar
   `--extractor-args youtubepot-bgutilscript:server_home=<dir>` onde <dir>
   contém `build/generate_once.js` — o arg `script_path` NÃO é o caminho do
   arquivo (o plugin faz join(arg,'../..','build',...)). Validar com
   `-v --extractor-args youtube:pot_trace=true` procurando
   "Generating POT via script"; sem isso o plugin falha silenciosamente.
4. Manter fallback de clientes só p/ erros de bloqueio: padrão → web_embedded
   → tv (tv falha em alguns vídeos; web_embedded costuma passar).

**Why:** a mesa de mistura quebrou em produção repetidamente por essas camadas
(runtime ausente → solver ausente → bot-check por IP). 403/429 esporádicos são
transitórios — retry resolve.

**How to apply:** ver downloadAudio/CLIENT_FALLBACKS/findPotScript na rota
yt-audio do api-server; novos usos de yt-dlp devem repetir o padrão. Deps
python ficam no pyproject.toml + uv.lock (produção instala a partir deles).

## IPv6 de datacenter é banido em bloco
Logs de produção provaram: PO token gerado com sucesso (bgutil:script-node) e mesmo assim "Sign in to confirm you're not a bot". A chave de cache mostrava IP de saída IPv6 do GCP (2600:1900::/…) — o YouTube bane faixas /64 de IPv6 de datacenter inteiras. **Correção: `--force-ipv4` em todos os spawns do yt-dlp.** Sempre checar o campo `ip` no cache spec do pot_trace para saber por qual família de IP o servidor está saindo.
