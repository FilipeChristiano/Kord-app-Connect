---
name: Transcription pipeline (acordes Audio Lab)
description: Why lyric transcription is a pluggable external worker, not local; and how transcription drives song identification.
---

# Como a transcrição é usada no Audio Lab (modelo atual)

Os DOIS modos de entrada (enviar áudio OU cantar via microfone/MediaRecorder)
seguem o mesmo pipeline: **transcrever → identificar a música por um trecho da
LETRA → puxar a cifra pronta do CifraClub**. Não existe mais colar letra manual,
e os acordes detectados do áudio NÃO são usados para montar a cifra. Resta apenas
uma rede de segurança "ajustar o nome da música" (busca por nome via `fetchCifra`).
No upload, a análise local de tom/BPM continua e roda antes do pipeline de letra.
Identificação por letra: `POST /api/cifra` aceita `{lyrics}` (snippet → DuckDuckGo
`site:cifraclub.com.br` → primeiro hit → fetchPrint) além de `{query}`.

# Pipeline de transcrição de letra (Audio Lab)

A transcrição automática de letra (separação voz/instrumental com Demucs +
reconhecimento com Faster-Whisper) **não roda no ambiente Replit**: sem GPU, RAM
limitada e sem stack Python de ML. Por isso o pipeline é **plugável via worker
externo**.

**Regra:** o app NUNCA simula nem inventa letra. Sem worker/STT disponível, a UI
mostra status honesto e oferece o ajuste manual do nome da música. A detecção de
tom/BPM continua client-side e independe do STT.

**Como conectar:** definir `TRANSCRIPTION_WORKER_URL`. O backend
(`api-server/src/routes/transcribe.ts`) encaminha os bytes do áudio para
`POST {WORKER}/transcribe` (auth Clerk obrigatória, timeout explícito, valida
schema mínimo `{text, lines}`). Sem a env, responde `503
external_processing_required`. O contrato do worker está documentado no topo desse
arquivo.

**Why:** evita prometer um recurso que o ambiente não suporta e mantém a
arquitetura pronta para plugar o worker no futuro sem reescrever o front.

## Caminho OpenAI gerenciado (sem worker) — limite de timestamps

O proxy gerenciado do Replit (AI Integrations, `AI_INTEGRATIONS_OPENAI_*`) **NÃO
suporta `whisper-1`** (retorna 400 "Model 'whisper-1' is not supported") nem o
endpoint `/audio/speech` (TTS). Só `gpt-4o-transcribe` / `gpt-4o-mini-transcribe`
funcionam para STT, e **apenas com `response_format: "json"`** — ou seja, **sem
timestamps por palavra/segmento**. `verbose_json` + `timestamp_granularities` só
existe no `whisper-1`, que está bloqueado.

**Consequência:** o caminho OpenAI devolve só o TEXTO da letra. Para alinhar
acordes, estimamos o tempo das linhas/palavras distribuindo pela duração real do
áudio (medida com `ffprobe`), proporcional à contagem de caracteres →
alinhamento **aproximado**, não palavra-a-palavra.

**Alinhamento preciso (CONECTADO):** a integração **ElevenLabs** (connector
gerenciado) é o caminho prioritário. O Scribe STT (`POST /v1/speech-to-text`,
`model_id: scribe_v1`, `timestamps_granularity: word`) devolve timestamps por
palavra → acordes caem na sílaba certa. ElevenLabs cobra no plano do usuário (não
nos créditos Replit); OpenAI gerenciado é a reserva (sem timestamps, alinhamento
estimado).

**Ordem de prioridade no backend:** (1) worker externo, (2) ElevenLabs Scribe
(preciso), (3) OpenAI gpt-4o-transcribe (reserva, estimado). Se o ElevenLabs
falhar ou não detectar palavras, cai para o OpenAI quando disponível; nunca
inventa letra. O áudio é sempre transcodado para MP3 mono 16kHz antes (ver
abaixo) e reusado em qualquer caminho.

**Como o connector é usado:** SDK `@replit/connectors-sdk` com
`createProxyFetch("elevenlabs")` (auth injetada pelo proxy, sem chave no código).
Disponibilidade via `listConnections({connector_names:"elevenlabs"})` cacheada.
**Why:** conexão de connector pode ter `status` nulo mesmo conectada — tratar
nulo/vazio como disponível, excluir só `"error"`.

## Limite de tamanho do proxy gerenciado → transcodar antes de enviar

O proxy gerenciado **rejeita corpos de áudio grandes com HTTP 413** (sem body).
Validado: WAV de ~42MB → 413; MP3 de ~14MB → OK. Isso é separado do limite de
25MB do próprio OpenAI. Antes era a causa do erro genérico "Não foi possível
concluir a transcrição automática" para músicas grandes (passavam do limite do
proxy mas não do guard de 25MB).

**Correção (padrão a manter):** **sempre transcodar o áudio para MP3 mono 16kHz**
(`ffmpeg -ac 1 -ar 16000 -b:a 64k -f mp3`) antes de enviar ao `gpt-4o-transcribe`.
16kHz mono é o ideal para STT e reduz drasticamente o tamanho (42MB → ~1.9MB), o
que elimina o 413 para qualquer música dentro do limite de 12min do app. Mapear
413 → 422 (mensagem "áudio grande demais") como rede de segurança.

**Why:** o gargalo real não é o limite do modelo, é o do proxy; transcodar resolve
de forma robusta e ainda melhora a qualidade da transcrição.
