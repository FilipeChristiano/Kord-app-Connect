#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Análise harmônica profissional de áudio (acordes) para o Audio Lab.

Pipeline (muito mais preciso que o detector feito à mão no navegador):
  1. Carrega o áudio em mono (22050 Hz).
  2. Separação harmônico/percussiva (HPSS) — remove a bateria, que polui a
     detecção de acordes.
  3. Estima e corrige a afinação (nem toda gravação está em 440 Hz).
  4. Cromagrama por CQT (resolução por nota muito melhor que FFT simples).
  5. Detecta o tom (perfis de Krumhansl–Kessler).
  6. Sincroniza por batida (segmentos = tempos da música) com mediana — robusto.
  7. Casa cada segmento com 24 tríades (maior/menor) usando cosseno, com bônus
     para o campo harmônico do tom detectado.
  8. Suaviza a sequência com Viterbi (penaliza trocas) → progressão coerente,
     sem o "tremido" que fazia os acordes parecerem aleatórios.
  9. Enriquece com baixo invertido (ex.: D/F#) via CQT grave e com sétimas
     (7, m7, 7M) de forma conservadora.

Saída: JSON em stdout com { key, bpm, timeline, chords }.
Uso: python3 chord_analyze.py <wav> [--bpm 92]
"""

import sys
import json
import argparse
import warnings

warnings.filterwarnings("ignore")

import numpy as np
import librosa


SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
FLAT_KEYS = {
    "F", "Bb", "Eb", "Ab", "Db", "Gb",
    "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm",
}
NOTE_PT = {
    "C": "Dó", "C#": "Dó#", "Db": "Réb", "D": "Ré", "D#": "Ré#", "Eb": "Mib",
    "E": "Mi", "F": "Fá", "F#": "Fá#", "Gb": "Solb", "G": "Sol", "G#": "Sol#",
    "Ab": "Láb", "A": "Lá", "A#": "Lá#", "Bb": "Sib", "B": "Si",
}

# Perfis de Krumhansl–Kessler (maior / menor).
KK_MAJ = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
KK_MIN = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)

SR = 22050
HOP = 2048

KEY_BONUS = 1.10       # bônus para acordes do campo harmônico
VITERBI_PEN = 0.15     # penalidade por troca de acorde (sequência coerente)
SEVENTH_REL = 0.62     # energia mín. da 7ª vs. média da tríade
SEVENTH_BG = 1.5       # a 7ª precisa se destacar do "fundo"
BASS_DOMINANCE = 1.25  # o quanto o baixo precisa se destacar


def detect_key(chroma_mean):
    cm = chroma_mean - chroma_mean.mean()
    norm_cm = np.linalg.norm(cm) + 1e-9
    best = (-2.0, 0, False)
    for tonic in range(12):
        for is_min, prof in ((False, KK_MAJ), (True, KK_MIN)):
            p = np.roll(prof, tonic)
            p = p - p.mean()
            corr = float(np.dot(cm, p) / (norm_cm * (np.linalg.norm(p) + 1e-9)))
            if corr > best[0]:
                best = (corr, tonic, is_min)
    corr, tonic, is_min = best
    conf = max(0.0, min(1.0, (corr + 1.0) / 2.0))
    return tonic, is_min, conf


def build_templates():
    tmpl = []
    for root in range(12):
        for is_min in (False, True):
            v = np.zeros(12)
            third = 3 if is_min else 4
            for iv in (0, third, 7):
                v[(root + iv) % 12] = 1.0
            v = v / (np.linalg.norm(v) + 1e-9)
            tmpl.append((root, is_min, v))
    return tmpl


def diatonic_set(tonic, is_min):
    s = set()
    if not is_min:
        for root, m in ((0, False), (2, True), (4, True), (5, False), (7, False), (9, True)):
            s.add(((tonic + root) % 12, m))
    else:
        for root, m in ((0, True), (3, False), (5, True), (7, True), (7, False), (8, False), (10, False)):
            s.add(((tonic + root) % 12, m))
    return s


def viterbi(scores, pen):
    """Maximiza soma das emissões penalizando trocas de estado."""
    T, K = scores.shape
    if T == 0:
        return np.zeros(0, dtype=int)
    dp = scores[0].copy()
    back = np.zeros((T, K), dtype=int)
    for t in range(1, T):
        prev = dp
        order = np.argsort(prev)[::-1]
        b1 = order[0]
        b2 = order[1] if K > 1 else order[0]
        new_dp = np.empty(K)
        for k in range(K):
            stay = prev[k]
            if k == b1:
                chg_val = prev[b2] - pen
                chg_idx = b2
            else:
                chg_val = prev[b1] - pen
                chg_idx = b1
            if stay >= chg_val:
                new_dp[k] = stay + scores[t, k]
                back[t, k] = k
            else:
                new_dp[k] = chg_val + scores[t, k]
                back[t, k] = chg_idx
        dp = new_dp
    path = np.zeros(T, dtype=int)
    path[-1] = int(np.argmax(dp))
    for t in range(T - 1, 0, -1):
        path[t - 1] = back[t, path[t]]
    return path


def analyze(path, bpm_hint=None):
    y, sr = librosa.load(path, sr=SR, mono=True)
    if y.size < sr:  # < 1s
        return {"key": None, "bpm": 0, "timeline": [], "chords": []}

    # Componente harmônico (sem bateria) para a harmonia; percussivo p/ a batida.
    y_h = librosa.effects.harmonic(y, margin=3.0)
    tuning = float(librosa.estimate_tuning(y=y_h, sr=sr))

    chroma = librosa.feature.chroma_cqt(
        y=y_h, sr=sr, hop_length=HOP, tuning=tuning, bins_per_octave=36
    )
    # Cromagrama grave (C1..B3) para descobrir a nota do baixo (inversões).
    cqt_bass = np.abs(
        librosa.cqt(
            y_h, sr=sr, hop_length=HOP,
            fmin=librosa.note_to_hz("C1"), n_bins=36, bins_per_octave=12,
        )
    )
    bass = np.zeros((12, cqt_bass.shape[1]))
    for b in range(cqt_bass.shape[0]):
        bass[b % 12] += cqt_bass[b]

    n = chroma.shape[1]
    bass = bass[:, :n]
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0][:n]

    # Batidas → fronteiras de segmento (harmonia muda em pontos métricos).
    try:
        _, beats = librosa.beat.beat_track(
            y=y, sr=sr, hop_length=HOP,
            start_bpm=float(bpm_hint) if bpm_hint else 120.0,
        )
    except Exception:
        beats = np.array([], dtype=int)

    bounds = sorted(set([0] + [int(b) for b in beats if 0 < int(b) < n] + [n]))
    if len(bounds) < 3:
        # Sem batidas confiáveis: janelas fixas de ~0.5s.
        step = max(1, int(round(0.5 * sr / HOP)))
        bounds = list(range(0, n, step)) + [n]
        bounds = sorted(set(bounds))

    seg_chroma, seg_bass, seg_e, seg_span = [], [], [], []
    for i in range(len(bounds) - 1):
        a, b = bounds[i], bounds[i + 1]
        if b <= a:
            continue
        seg_chroma.append(np.median(chroma[:, a:b], axis=1))
        seg_bass.append(np.median(bass[:, a:b], axis=1))
        seg_e.append(float(np.mean(rms[a:b])))
        seg_span.append((a, b))
    if not seg_chroma:
        return {"key": None, "bpm": 0, "timeline": [], "chords": []}

    seg_chroma = np.array(seg_chroma)  # (S, 12)
    seg_bass = np.array(seg_bass)
    seg_e = np.array(seg_e)

    tonic, is_min, key_conf = detect_key(chroma.mean(axis=1))
    key_sym = SHARP[tonic] + ("m" if is_min else "")
    names = FLAT if key_sym in FLAT_KEYS else SHARP
    dia = diatonic_set(tonic, is_min)
    templates = build_templates()

    # Matriz de pontuação (cosseno) + bônus do campo harmônico.
    S = len(seg_chroma)
    raw = np.zeros((S, 24))
    biased = np.zeros((S, 24))
    for si in range(S):
        c = seg_chroma[si]
        nc = np.linalg.norm(c) + 1e-9
        for ti, (root, m, vec) in enumerate(templates):
            dot = float(np.dot(c, vec) / nc)
            raw[si, ti] = dot
            biased[si, ti] = dot * (KEY_BONUS if (root, m) in dia else 1.0)

    path = viterbi(biased, VITERBI_PEN)

    # Limiar de silêncio relativo.
    med_e = float(np.median(seg_e)) if S else 0.0
    min_e = med_e * 0.10

    times = librosa.frames_to_time(np.array(bounds), sr=sr, hop_length=HOP)

    def seg_label(si, ti):
        root, m, _ = templates[ti]
        c = seg_chroma[si]
        third = (root + (3 if m else 4)) % 12
        fifth = (root + 7) % 12
        triad_mean = (c[root] + c[third] + c[fifth]) / 3.0
        others = [c[i] for i in range(12) if i not in (root, third, fifth)]
        bg_mean = float(np.mean(others)) if others else 0.0
        suffix = "m" if m else ""
        if triad_mean > 0:
            b7 = c[(root + 10) % 12]
            M7 = c[(root + 11) % 12]

            def stands_out(v, rel):
                return v >= triad_mean * rel and v >= bg_mean * SEVENTH_BG

            if m:
                if stands_out(b7, SEVENTH_REL):
                    suffix = "m7"
            elif b7 >= M7 and stands_out(b7, SEVENTH_REL):
                suffix = "7"
            elif stands_out(M7, SEVENTH_REL + 0.05):
                suffix = "7M"
        label = names[root] + suffix

        # Baixo invertido: baixo dominante = 3ª ou 5ª do acorde.
        bvec = seg_bass[si]
        order = np.argsort(bvec)[::-1]
        b_idx = int(order[0])
        b_second = float(bvec[order[1]]) if len(order) > 1 else 0.0
        if (
            b_idx != root
            and b_idx in (third, fifth)
            and bvec[b_idx] >= max(b_second, 1e-9) * BASS_DOMINANCE
        ):
            label += "/" + names[b_idx]
        return label

    # Constrói a linha do tempo, descartando trechos quase em silêncio e
    # mesclando segmentos consecutivos iguais.
    timeline = []
    for si in range(S):
        if seg_e[si] < min_e:
            continue
        ti = int(path[si])
        label = seg_label(si, ti)
        a, b = seg_span[si]
        start = float(times[bounds.index(a)]) if a in bounds else float(librosa.frames_to_time(a, sr=sr, hop_length=HOP))
        end = float(times[bounds.index(b)]) if b in bounds else float(librosa.frames_to_time(b, sr=sr, hop_length=HOP))
        conf = float(raw[si, ti])
        if timeline and timeline[-1]["symbol"] == label:
            timeline[-1]["end"] = end
            timeline[-1]["confidence"] = max(timeline[-1]["confidence"], conf)
        else:
            timeline.append(
                {"symbol": label, "start": start, "end": end, "confidence": max(0.0, min(1.0, conf))}
            )

    chords = [t["symbol"] for t in timeline]
    pt_label = NOTE_PT.get(SHARP[tonic], SHARP[tonic]) + (" menor" if is_min else " Maior")

    try:
        tempo = float(librosa.beat.tempo(y=y, sr=sr, hop_length=HOP)[0])
    except Exception:
        tempo = float(bpm_hint or 0)

    return {
        "key": {
            "symbol": key_sym,
            "tonic": int(tonic),
            "isMinor": bool(is_min),
            "confidence": float(key_conf),
            "ptLabel": pt_label,
        },
        "bpm": tempo,
        "timeline": timeline,
        "chords": chords,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--bpm", type=float, default=None)
    args = ap.parse_args()
    try:
        result = analyze(args.audio, args.bpm)
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
    except Exception as e:  # erro claro p/ o servidor cair no fallback
        sys.stderr.write("chord_analyze error: %r\n" % (e,))
        sys.exit(1)


if __name__ == "__main__":
    main()
