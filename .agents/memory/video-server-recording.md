---
name: Gravação de MP4 do vídeo no servidor
description: Como gravar o kordi-video em MP4 quando o export do preview pane falha para o usuário.
---

Quando o export do preview pane não funciona, dá para gravar o MP4 no próprio servidor.

**Why:** o usuário relatou que o download do export nunca finalizava; a gravação server-side entrega o arquivo direto via present_asset.

**How to apply:**
1. Dependências Nix: `chromium`, `xorg.xvfb` (ffmpeg já existe). pulseaudio/pactl já disponíveis.
2. Processos em background NÃO sobrevivem entre chamadas bash (nem com setsid) — fazer tudo em UMA chamada (< 120s): pulseaudio -D + null sink `rec`, Xvfb :99 1920x1088, chromium kiosk com `PULSE_SINK=rec`, ffmpeg x11grab (-draw_mouse 0) + `-f pulse -i rec.monitor`, `-t 100` (pega 1 loop completo + margem).
3. Flags obrigatórias do chromium: `--no-sandbox --disable-gpu --autoplay-policy=no-user-gesture-required --kiosk --hide-scrollbars --lang=pt-BR --accept-lang=pt-BR --user-data-dir` com Preferences `{"translate":{"enabled":false}}` — só isso mata a bolha de tradução (--disable-features=Translate NÃO basta).
4. Corte exato: VideoTemplate renderiza marcador 64x8 no topo-esquerdo quando URL tem `?rec=1` (intro vermelho, showcase verde, outro azul). Gravar em 1088 de altura, detectar transições com crop+signalstats (VAVG/UAVG), cortar do 1º vermelho ao vermelho seguinte e `crop=1920:1080:0:8` para remover o marcador.
5. O áudio composto re-seeka por cena, então qualquer loop serve; validar RMS por trecho (showcase ~-19dB) e frames extraídos.
