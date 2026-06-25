#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# Rastreamento de batidas (beat tracking) — mesmo princípio dos apps profissionais.
#
# Em vez de estimar uma "grade rígida" (andamento + fase) e torcer para encaixar,
# rastreamos a PULSAÇÃO REAL da música: envelope de início (onset strength) +
# rastreador por programação dinâmica do librosa. Devolve os INSTANTES (s) de cada
# batida, para o metrônomo clicar exatamente em cima de cada batida da música —
# acompanhando inclusive pequenas variações de andamento.
#
# Uso: detect_beats.py <input_wav> [bpm_hint]
# Saída (stdout): JSON {"ok": true, "bpm": float, "beats": [float, ...]}
#                 ou   {"ok": false, "error": "..."}
# ─────────────────────────────────────────────────────────────────────────────
import json
import sys


def main() -> int:
    if len(sys.argv) < 2:
        sys.stdout.write(json.dumps({"ok": False, "error": "usage: input [bpm_hint]"}))
        return 2

    inp = sys.argv[1]
    try:
        hint = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    except ValueError:
        hint = 0.0
    if not (40.0 <= hint <= 240.0):
        hint = 0.0

    try:
        import numpy as np
        import librosa

        HOP = 512
        # Mono 22.05 kHz: resolução de sobra para a pulsação e rápido de processar.
        y, sr = librosa.load(inp, sr=22050, mono=True)
        if y.size < sr:  # menos de ~1s de áudio: não dá para rastrear.
            sys.stdout.write(json.dumps({"ok": False, "error": "audio_too_short"}))
            return 0

        # Envelope de início: realça os ataques (percussão/acordes) que marcam a
        # batida. É a entrada clássica do rastreador de batidas.
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)

        # Rastreador por programação dinâmica (Ellis): encontra o andamento e a
        # sequência de batidas que melhor explica o envelope. A dica de BPM fixa a
        # oitava do andamento (evita pegar metade/dobro do tempo).
        tempo, beats = librosa.beat.beat_track(
            onset_envelope=onset_env,
            sr=sr,
            hop_length=HOP,
            start_bpm=hint if hint > 0 else 120.0,
            trim=False,
            units="time",
        )

        bpm = float(np.atleast_1d(tempo)[0])
        times = sorted(round(float(t), 4) for t in np.atleast_1d(beats) if float(t) >= 0)
        sys.stdout.write(json.dumps({"ok": True, "bpm": bpm, "beats": times}))
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)[:300]}))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
