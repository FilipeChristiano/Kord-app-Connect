---
name: Landing demo assets (áudio real)
description: Como os áudios da demo do HeroShowcase (/assinar) foram gerados via o pipeline real do app; como regenerar.
---

Os arquivos em `artifacts/acordes/public/landing-audio/` vêm do fluxo REAL do app, nunca de material sintético:
- CUIDADO com confusão de arquivos: YouTube `ijNCc7ICCck` (5:10) é SANTO PRA SEMPRE (o app resolve "santo pra sempre gabriel guedes" → esse id); o arquivo de JÓ do dono é o mp3 do attached_assets (5:17, cópia em /tmp/jo-original.mp3). Já houve troca acidental entre eles.
- `audiolab-demo.mp3` (15s): "Santo Pra Sempre — Gabriel Guedes" (tom Db), refrão a partir de 169.97s dos stems Demucs (`/tmp/v15.wav`+`/tmp/i15.wav`). Click = grade do detector do NAVEGADOR (analyzeBpm no full mix): 144 BPM, anchor=223.6546+0.2664s, período 60/144, batidas TODAS IGUAIS (weak: triângulo 850Hz, sem acento — igual à mesa, que chama playClick(...,"weak") para tudo), só na fase 0–6s. Envelope baked: 0–6s voz+instrumental+click, 6–10.5s só voz, 10.5–15s só instrumental (rampas de 0.5s); MESA_FASES espelha esses tempos. detect_beats.py do servidor dava 95.7 — o número/click da mesa vem do NAVEGADOR.
- `metronomo-jo.mp3` (8.5s): "Jó — Midian Lima", ARQUIVO ORIGINAL do dono (/tmp/jo-original.mp3). Detector do navegador: 132 BPM (anchor=259.5991+0.2664s, período 60/132); clipe começa em 257.1505s; clicks TODOS IGUAIS a partir de 2.715s do clipe → bolinhas iniciam 415ms após o lock (2.3s). BPM_TARGET=132 na cena; sem tempo forte (dono exige batidas iguais, áudio e bolinhas).

**Como regenerar** (mesmo fluxo do app):
1. `POST /api/cifra` `{query, pick}` → cifra real + `youtubeId`; `POST /api/stems/prepare-yt` → Demucs (~6 min) → stems em `/tmp/harmonic-stems/yt_<id>/`.
2. Batidas: rodar o `analyzeBpm` do navegador (página dev temporária + screenshot) sobre o áudio completo; usar anchor = segment.start + phaseSec da opção recomendada; click sintetizado uniforme (triângulo 850Hz, ~45ms, sem acento).
3. Trechos escolhidos por maior energia (volumedetect em janelas de 5s); mixagem/envelopes via script Python + loudnorm I=-15.
4. Sofisticador: `processChordChart` de `data/substitutions.ts` (nível intermediário) sobre o trecho real "As muitas gerações…"/"Cantando ao cordeiro…" gera os pares da cena: C→C7M(9), C4 fica C4 (não reconhecido como acorde), Am7→Am7(9), G→G7sus4, F9→F7M(9).

**Why:** o dono exige que a demo da landing use exatamente o que o app gera — nunca inventar áudio/cifra.
**How to apply:** qualquer mudança de música/trecho na demo deve repetir esse fluxo e atualizar BPM/tom/acordes/tempos das cenas do HeroShowcase em sincronia com os arquivos. BPM mostrado nas cenas deve vir do detector do NAVEGADOR sobre o áudio exato que o app usaria (cache em `/tmp/harmonic-yt-audio/`). Obs: yt-dlp no dev está bloqueado pelo YouTube (bot check); reutilizar o cache.
**Atenção:** trechos de gravações reais hospedados publicamente na landing — direitos autorais são responsabilidade do dono; já sinalizado a ele.
