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
Identificação: `POST /api/cifra` aceita `{lyrics}`, `{query}` e `{pick}`.

**Fontes de busca (decisão durável):** combinação de DUAS fontes abertas, sem
chave nem connector, ambas funcionam server-side:
- **CifraClub Solr** (`https://solr.sscdn.co/cc/h2/?q=...`, JSONP — tirar o
  `(...)`): índice do próprio CifraClub. Doc traz slug do artista (`d`), slug da
  música (`u`), título (`m`), nome do artista (`a`). É a fonte da CIFRA em si e
  busca PELO NOME. **Indexa título/artista, NÃO a letra inteira.**
- **Deezer** (`https://api.deezer.com/search?q=...`, JSON aberto, sem key):
  **indexa a letra**, então identifica a música por um trecho CANTADO mesmo
  quando o título não está no trecho (ex.: "Atos 2" começa em "nós estamos
  aqui..."). Usado só internamente p/ achar título+artista → confirma a cifra no
  Solr (`"title artist"`, valida que o artista bate). Nunca vaza ao cliente.

**Ordenação que importa:** pela LETRA → Deezer PRIMEIRO (casa a letra de verdade),
depois Solr por prefixos curtos (3,4,6 palavras) como reforço (útil quando o
trecho começa pelo título). Pelo NOME → Solr primeiro. Se Solr-por-prefixo roda
antes do Deezer, ele preenche os 5 slots com músicas HOMÔNIMAS erradas (o prefixo
"nós estamos aqui" casa títulos literais "Nós Estamos Aqui", não "Atos 2"). O
Deezer/`identifyByLyrics` é calculado UMA vez por request e reusado em
resolve+gatherCandidates. DuckDuckGo virou só reserva (responde 202
"anomaly"/CAPTCHA quase sempre — era a causa original de "nenhuma versão").
**Why:** scraping de buscador genérico é bloqueado; Solr+Deezer não são, e juntos
cobrem nome E letra (com ou sem o título no trecho).

## Letra CANTADA é ruidosa → IA SÓ limpa a transcrição, Deezer identifica

O trecho CANTADO chega transcrito sem acentos / com grafia errada / palavra
parecida trocada. A busca textual do Deezer é **sensível a acento E a tamanho**:
casa "Atos 2" só com trecho CURTO (≈3–8 palavras iniciais) e COM acentos; com
acento removido ou ≥9 palavras, erra ou volta vazio → caía no Solr-por-prefixo →
homônimos errados. Era a causa do bug "cantei e veio a música errada".

**Decisão durável (NÃO reverter para LLM-identifica):** usar LLM **APENAS para
CORRIGIR a transcrição** (`llmCleanLyrics`, gpt-4o-mini, JSON `{text}`, mesmas
palavras/ordem, sem adivinhar) e então identificar pelo Deezer com o texto limpo.
- **NUNCA** pedir à IA para IDENTIFICAR a música: testado e REJEITADO — gpt-4o
  chuta louvores de TEMA parecido ("Santo Espírito", "Sol da Manhã"), gerando até
  auto-resolve para a música ERRADA. Sede/fogo/graça/render-se são comuns a muitos
  louvores; identificar por tema é alucinação.
- `deezerByLyricText`: tenta o texto limpo, depois o original como reserva, com
  contagem decrescente de palavras iniciais [8,6,5,4] até obter hits (Deezer
  prefere trechos curtos).
- `identifyByLyrics`: confirma cada hit no Solr (`confirmSong`) e DEDUPLICA por
  TÍTULO normalizado (covers do mesmo louvor por artistas diferentes = MESMA
  música → fica a 1ª, canônica no topo do Deezer).
- **Auto-resolve (precisão):** só resolve direto com UMA música distinta confirmada
  E sinal forte — Deezer trouxe 1 resultado OU o mesmo título DOMINOU o topo (≥2
  gravações). Vários títulos homônimos distintos casando trecho genérico → devolve
  candidatos `{id,title,artist}` p/ o usuário escolher (id = base64url
  "artist/song").
- `confirmSong`: reserva de "1 único hit no Solr" só vale se o TÍTULO também bate
  (`titleClose`); evita aceitar um hit solto de OUTRA música.
**Why:** Deezer é o único que indexa letra mas é frágil a ruído; a IA cobre só o
ruído (acentos/grafia) onde é confiável, sem o risco de identificação por tema.

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
