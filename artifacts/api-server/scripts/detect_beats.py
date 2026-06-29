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
# COMPASSO (simples × composto): além do andamento, identificamos o compasso.
#   • Compasso COMPOSTO (6/8): cada tempo se divide em 3 (subdivisão ternária).
#     Detectamos pela AUTOCORRELAÇÃO do envelope: se há uma periodicidade forte a
#     3× o pulso principal (a colcheia) e fraca a 2× (a divisão binária), a música
#     é "sentida em 3" → 6/8. Nesse caso a grade vira a COLCHEIA (6 por compasso),
#     que é como um metrônomo profissional marca 6/8.
#   • Compasso SIMPLES: devolvemos meter=null e deixamos a distinção 3/4×4/4 a
#     cargo da análise do envio no cliente (no servidor ela é frágil/dependente
#     da oitava). O servidor só agrega o NOVO: o composto (6/8).
#
# INTRO SEM BATIDA: se a percussão só entra depois de alguns segundos (intro de
# pad/voz), o começo livre/rubato contamina o ajuste global de tempo/fase. Medimos
# o tempo/fase no GROOVE (parte percussiva) e re-fasamos a grade inteira, estendendo
# até o início — o metrônomo marca desde o começo, mas no tempo certo das batidas.
#
# Uso: detect_beats.py <input_wav> [bpm_hint]
# Saída (stdout): JSON {"ok": true, "bpm": float, "beats": [float, ...], "meter": "6/8"|null}
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

# ── Compasso composto (6/8) ──────────────────────────────────────────────────
# Faixa de BPM onde procuramos o PULSO PRINCIPAL (a semínima pontuada do 6/8, ou
# a semínima do compasso simples). Fora dela quase sempre é metade/dobro.
MAIN_MIN_BPM = 40.0
MAIN_MAX_BPM = 160.0
# A subdivisão ternária (3×) precisa ser claramente presente para chamar de 6/8.
# Limiar absoluto + margem sobre a divisão binária (2×) → conservador, para uma
# música 4/4 (onde a colcheia 2× domina) nunca ser confundida com 6/8.
TERNARY_MIN = 0.45
TERNARY_OVER_BINARY = 0.9

# ── Início da percussão (intro sem batida) ───────────────────────────────────
# Muita música (worship em especial) abre com 10-20 s de intro só de pad/voz, sem
# percussão. Clicar o metrônomo nesse trecho livre/rubato soa "fora do ritmo".
# Por isso "esperamos a música": detectamos quando a PERCUSSÃO entra de fato e só
# marcamos as batidas dali em diante — cravando no início do groove.
MIN_INTRO = 2.0        # só aparamos se o intro sem batida passar disso (s)
PERC_REL_THRESH = 0.2  # fração do pico (p95) de energia percussiva p/ contar "tem batida"
PERC_SUSTAIN = 1.5     # a batida precisa se manter por este tempo (s) p/ valer
PERC_FILL = 0.6        # fração mínima do trecho sustentado que precisa estar acima do limiar


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
        frate = sr / HOP  # quadros por segundo (para converter lag ↔ BPM)

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

        def track(start_bpm: float) -> "np.ndarray":
            _tempo, b = librosa.beat.beat_track(
                onset_envelope=onset_env,
                sr=sr,
                hop_length=HOP,
                start_bpm=start_bpm,
                trim=False,
                units="time",
            )
            b = np.atleast_1d(b).astype(float)
            return b[b >= 0]

        # ── Análise do compasso: simples (binário) × composto (ternário, 6/8) ──
        # Autocorrelação do envelope (sem média): revela a hierarquia métrica —
        # o pulso principal e suas subdivisões. Numa música 6/8 a subdivisão forte
        # está a 3× o pulso (a colcheia); numa 4/4, a 2× (a colcheia binária).
        o = onset_env - float(np.mean(onset_env))
        ac = librosa.autocorrelate(o, max_size=int(4 * frate))
        if ac.size > 2:
            ac[:2] = 0.0

        def ac_at(lag: float) -> float:
            li = int(round(lag))
            return float(ac[li]) if 0 < li < len(ac) else 0.0

        compound = False
        main_bpm = 0.0
        if ac.size > 4:
            lmin = max(2, int(round(60.0 * frate / MAIN_MAX_BPM)))
            lmax = min(len(ac) - 1, int(round(60.0 * frate / MAIN_MIN_BPM)))
            best_lag = 0
            best_val = 0.0
            for lag in range(lmin, lmax):
                v = ac[lag]
                if v > ac[lag - 1] and v >= ac[lag + 1] and v > best_val:
                    best_val = v
                    best_lag = lag
            if best_lag > 0 and best_val > 0:
                main_bpm = 60.0 * frate / best_lag
                # Subdivisões do pulso principal (lag menor = frequência maior):
                s2 = ac_at(best_lag / 2.0) / best_val  # binária (2×) → colcheia 4/4
                s3 = ac_at(best_lag / 3.0) / best_val  # ternária (3×) → colcheia 6/8
                s4 = ac_at(best_lag / 4.0) / best_val  # semicolcheia (4×)
                # Composto quando a subdivisão ternária é forte E supera a binária
                # e a semicolcheia — sinal claro de "sentido em 3" (6/8).
                compound = (
                    s3 >= TERNARY_MIN
                    and s3 >= s2 * TERNARY_OVER_BINARY
                    and s3 > s4
                )

        if compound:
            # 6/8: a grade vira a COLCHEIA (3× o pulso principal) → 6 por compasso,
            # como um metrônomo profissional marca um compasso composto. A rede de
            # segurança de "tempo dobrado" NÃO se aplica aqui (ela é p/ binário).
            #
            # IMPORTANTE: NÃO re-rastreamos as batidas a 3× o tempo. O beat_track a
            # 3× costuma "travar" numa FASE errada (a 1ª colcheia caía ~0,35 s fora
            # do pulso real) e num andamento levemente adiantado — o metrônomo
            # entrava fora do ritmo. Em vez disso, pegamos o PULSO PRINCIPAL (que é
            # a periodicidade mais forte e de fase confiável) e o subdividimos em 3
            # colcheias iguais. Assim a grade fica colada ao pulso sentido, a 1ª
            # colcheia cai exatamente no 1º pulso e o andamento é exatamente 3×.
            main_beats = track(main_bpm)
            if main_beats.size >= 2:
                eighths = []
                for i in range(main_beats.size - 1):
                    a = float(main_beats[i])
                    step = (float(main_beats[i + 1]) - a) / 3.0
                    eighths.append(a)
                    eighths.append(a + step)
                    eighths.append(a + 2.0 * step)
                eighths.append(float(main_beats[-1]))
                beats = np.asarray(eighths, dtype=float)
            else:
                beats = track(main_bpm * 3.0)
            meter = "6/8"
        else:
            # Camada 1: a dica vira start_bpm já na oitava certa. Sem dica, 100 BPM
            # é um centro neutro que evita o viés do padrão (120) p/ o tempo dobrado.
            beats = track(_fold_to_felt(hint))

            # Camada 2 (rede de segurança contra o contratempo): se o resultado vier
            # em tempo dobrado, as batidas alternadas têm forças bem diferentes.
            # Cortamos pela metade mantendo a sub-fase MAIS FORTE (batidas reais).
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
                if bpm_now > 125.0 and ratio >= ALT_RATIO and bpm_now / 2.0 >= HALVE_FLOOR:
                    beats = even if s_even >= s_odd else odd
                else:
                    break

            # Compasso simples (3/4 × 4/4): NÃO decidimos aqui. A distinção 3/4×4/4
            # depende muito da oitava/dica e é frágil no servidor — deixamos a cargo
            # da análise do envio (initialTimeSignature) no cliente, que já fazia
            # isso. O servidor só agrega a inteligência NOVA: o composto (6/8).
            meter = None

        # ── Travar o metrônomo no GROOVE, mas marcar desde o início ──────────
        # Música com intro de pad/voz (sem percussão) tem um começo livre/rubato
        # que CONTAMINA o ajuste global de tempo/fase. Detectamos onde a PERCUSSÃO
        # entra de fato, medimos o tempo/fase ali (parte confiável) e ESTENDEMOS a
        # grade para trás até o início. Assim o metrônomo marca desde o começo, mas
        # no tempo certo ditado pelas batidas. A separação harmônico/percussiva
        # isola a percussão de pad/voz (que não dão batida regular).
        try:
            yp = librosa.effects.percussive(y)
            prms = librosa.feature.rms(y=yp, hop_length=HOP)[0]
            if prms.size and beats.size:
                win = max(1, int(0.5 * frate))
                sm = np.convolve(prms, np.ones(win) / win, mode="same")
                p95 = float(np.percentile(sm, 95))
                if p95 > 0:
                    above = sm > (PERC_REL_THRESH * p95)
                    need = max(1, int(PERC_SUSTAIN * frate))
                    p_start = 0.0
                    for i in range(max(1, above.size - need)):
                        if above[i] and float(above[i:i + need].mean()) > PERC_FILL:
                            p_start = float(i / frate)
                            break
                    if p_start > MIN_INTRO:
                        groove = beats[beats >= p_start - 1e-3]
                        if groove.size >= 4:
                            # CRÍTICO: mantemos as batidas REAIS do groove (rastreadas,
                            # seguem o andamento da música e NÃO desviam ao longo dela).
                            # Só o intro — que não tem batida para rastrear — é estendido
                            # para trás, com o intervalo LOCAL do começo do groove. Uma
                            # grade 100% sintética (intervalo fixo a partir de 1 ponto)
                            # acumula erro e "adianta" no fim da música; por isso não.
                            head = groove[: min(groove.size, 16)]
                            interval = float(np.median(np.diff(head)))
                            if interval > 0:
                                anchor = float(groove[0])  # batida sólida no groove
                                k = int(np.floor(anchor / interval - 1e-9))
                                if k > 0:
                                    back = anchor - interval * np.arange(k, 0, -1)
                                    back = back[back >= -1e-9]
                                    beats = np.concatenate([back, groove])
                                else:
                                    beats = groove
        except Exception:
            pass  # se a separação falhar, mantemos a grade global (sem re-fasar)

        bpm = median_bpm(beats)
        times = sorted(round(float(t), 4) for t in beats)
        sys.stdout.write(json.dumps({"ok": True, "bpm": bpm, "beats": times, "meter": meter}))
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)[:300]}))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
