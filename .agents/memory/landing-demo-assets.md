---
name: Landing demo assets (áudio real)
description: Como os áudios da demo do HeroShowcase (/assinar) foram gerados via o pipeline real do app; como regenerar.
---

Os arquivos em `artifacts/acordes/public/landing-audio/` (voz/instrumental/metronomo/mix) vêm do fluxo REAL do app com "Santo Pra Sempre — Gabriel Guedes" (tom Db, BPM detectado ~95.7), não de material sintético.

**Como regenerar** (mesmo fluxo do app, via API local):
1. `POST /api/cifra` `{query, pick}` → cifra real + `youtubeId`.
2. `POST /api/stems/prepare-yt` `{id}` → job Demucs (~6 min); status em `GET /api/stems/status?key=yt_<id>`; stems em `/tmp/harmonic-stems/yt_<id>/{vocals,instrumental}.mp3`.
3. `GET /api/stems/beats?key=yt_<id>` → instantes reais das batidas; o click da demo é sintetizado (triangular, acento no 1) nesses instantes.
4. Trecho usado: refrão a partir de ~169.97s, 10s, escolhido por maior energia vocal (volumedetect em janelas de 5s).
5. Sofisticador: `processChordChart` de `data/substitutions.ts` rodado via tsx sobre o refrão real gera as substituições mostradas na cena.

**Why:** o dono exige que a demo da landing use exatamente o que o app gera — nunca inventar áudio/cifra.
**How to apply:** qualquer mudança de música/trecho na demo deve repetir esse fluxo; atualizar também BPM/tom/acordes nas cenas do HeroShowcase.
**Atenção:** o trecho é da gravação real (10s) hospedado publicamente na landing — direitos autorais são responsabilidade do dono; já sinalizado a ele.
