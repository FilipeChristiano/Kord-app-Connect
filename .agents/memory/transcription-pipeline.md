---
name: Transcription pipeline (acordes Audio Lab)
description: Why lyric transcription is a pluggable external worker, not local.
---

# Pipeline de transcrição de letra (Audio Lab)

A transcrição automática de letra (separação voz/instrumental com Demucs +
reconhecimento com Faster-Whisper) **não roda no ambiente Replit**: sem GPU, RAM
limitada e sem stack Python de ML. Por isso o pipeline é **plugável via worker
externo**.

**Regra:** o app NUNCA simula nem inventa letra. Sem worker, a UI mostra status
honesto ("Transcrição automática exige processamento externo") e a colagem manual
fica como alternativa secundária. A detecção de acordes (tom/BPM/acordes +
timestamps) é client-side e independe do worker.

**Como conectar:** definir `TRANSCRIPTION_WORKER_URL`. O backend
(`api-server/src/routes/transcribe.ts`) encaminha os bytes do áudio para
`POST {WORKER}/transcribe` (auth Clerk obrigatória, timeout explícito, valida
schema mínimo `{text, lines}`). Sem a env, responde `503
external_processing_required`. O contrato do worker está documentado no topo desse
arquivo.

**Why:** evita prometer um recurso que o ambiente não suporta e mantém a
arquitetura pronta para plugar o worker no futuro sem reescrever o front.
