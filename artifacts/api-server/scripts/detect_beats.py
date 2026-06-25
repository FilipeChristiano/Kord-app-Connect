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
# OITAVA DO ANDAMENTO (a causa do "contratempo"): o rastreador pode travar no
# DOBRO do tempo sentido (ex.: 143 BPM numa balada de ~72). Aí metade dos cliques
# cai no contratempo. Corrigimos em duas camadas:
#   1. A dica de BPM é dobrada para a faixa "sentida" antes de virar start_bpm,
#      para o rastreador já mirar a oitava certa.
#   2. Rede de segurança: se mesmo assim o resultado vier em tempo dobrado, as
#      batidas "no meio" ficam bem mais fracas que as batidas reais no envelope de
#      início. Detectamos essa alternância forte/fraca e cortamos pela metade,
#      MANTENDO a sub-fase mais forte (as batidas reais) — nunca o contratempo.
#
# Uso: detect_beats.py <input_wav> [bpm_hint]
# Saída (stdout): JSON {"ok": true, "bpm": float, "beats": [float, ...]}
#                 ou   {"ok": false, "error": "..."}
# ─────────────────────────────────────────────────────────────────────────────
import json
import sys


HOP = 512
# Faixa perceptual onde quase toda música é "sentida"/contada. Fora dela, é quase
# sempre metade/dobro do andamento real.
FELT_MIN = 60.0
FELT_MAX = 150.0
# Acima desta razão entre a sub-fase forte e a fraca, as batidas "no meio" são
# claramente mais fracas → estamos em tempo dobrado e devemos cortar pela metade.
ALT_RATIO = 1.25
# Não cortamos abaixo deste andamento (evita transformar um tempo já correto e
# lento num andamento irreal pela metade).
HALVE_FLOOR = 55.0


def _fold_to_felt(v: float) -> float:
    """Dobra/divide por 2 até cair na faixa perceptual (start_bpm da oitava certa)."""
    if v <= 0:
        return 100.0
    while v > FELT_MAX:
        v /= 2.0
    while v < FELT_MIN:
        v *= 2.0
    return v


def main() -> int:
    if len(sys.argv) < 2:
        sys.stdout.write(json.dumps({"ok": False, "error": "usage: input [bpm_hint]"}))
        return 2

    inp = sys.argv[1]
    try:
        hint = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    except ValueError:
        hint = 0.0
    if not (40.0 <= hint <= 280.0):
        hint = 0.0

    try:
        import numpy as np
        import librosa

        # Mono 22.05 kHz: resolução de sobra para a pulsação e rápido de processar.
        y, sr = librosa.load(inp, sr=22050, mono=True)
        if y.size < sr:  # menos de ~1s de áudio: não dá para rastrear.
            sys.stdout.write(json.dumps({"ok": False, "error": "audio_too_short"}))
            return 0

        # Envelope de início: realça os ataques (percussão/acordes) que marcam a
        # batida. É a entrada clássica do rastreador de batidas.
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)

        def strength_at(times: "np.ndarray") -> float:
            """Força média do envelope de início nos instantes dados."""
            if times.size == 0:
                return 0.0
            frames = librosa.time_to_frames(times, sr=sr, hop_length=HOP)
            frames = np.clip(frames, 0, len(onset_env) - 1)
            return float(np.mean(onset_env[frames]))

        def median_bpm(b: "np.ndarray") -> float:
            if b.size < 2:
                return 0.0
            d = np.diff(b)
            d = d[d > 1e-3]
            return 60.0 / float(np.median(d)) if d.size else 0.0

        # Camada 1: a dica vira start_bpm já na oitava certa. Sem dica, 100 BPM é
        # um centro neutro que evita o viés do padrão (120) para o tempo dobrado.
        start_bpm = _fold_to_felt(hint)

        # Rastreador por programação dinâmica (Ellis): encontra o andamento e a
        # sequência de batidas que melhor explica o envelope.
        _tempo, beats = librosa.beat.beat_track(
            onset_envelope=onset_env,
            sr=sr,
            hop_length=HOP,
            start_bpm=start_bpm,
            trim=False,
            units="time",
        )
        beats = np.atleast_1d(beats).astype(float)
        beats = beats[beats >= 0]

        # Camada 2 (rede de segurança contra o contratempo): se o resultado vier em
        # tempo dobrado, as batidas alternadas têm forças bem diferentes. Cortamos
        # pela metade mantendo a sub-fase MAIS FORTE (as batidas reais da música).
        for _ in range(2):
            if beats.size < 4:
                break
            bpm_now = median_bpm(beats)
            even = beats[0::2]
            odd = beats[1::2]
            s_even = strength_at(even)
            s_odd = strength_at(odd)
            hi = max(s_even, s_odd)
            lo = min(s_even, s_odd)
            ratio = hi / lo if lo > 0 else 999.0
            # Só cortamos quando o andamento está na zona propensa a dobrar e a
            # alternância forte/fraca é clara — e o resultado segue musical.
            if bpm_now > 125.0 and ratio >= ALT_RATIO and bpm_now / 2.0 >= HALVE_FLOOR:
                beats = even if s_even >= s_odd else odd
            else:
                break

        bpm = median_bpm(beats)
        times = sorted(round(float(t), 4) for t in beats)
        sys.stdout.write(json.dumps({"ok": True, "bpm": bpm, "beats": times}))
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)[:300]}))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
