---
name: Meter detection incl. 6/8 (acordes audio studio)
description: How compound (6/8) meter is detected server-side and why the server never relabels simple meters.
---

# Meter / time-signature intelligence (Harmonic audio studio)

Meter for the mixer metronome is decided **server-side** in `detect_beats.py` from the
onset-strength envelope, then threaded through `BeatResult` → `/stems/beats` →
`cifra-remote StemBeats.meter` → `audio-lab setMetroTs(server.meter ?? initialTimeSignature)`.

## Compound (6/8) detection — the durable rule
Compound meter = each felt beat subdivides into **3** (ternary). Detect it from the
**global autocorrelation of the onset envelope**: find the strongest main-pulse peak,
then compare the subdivision strengths at `3×` (ternary) vs `2×` (binary) vs `4×`.
Flag 6/8 only when the ternary (3×) subdivision is strong AND clearly beats the binary.
- **Why:** a clean 3:1 ratio between the eighth-note pulse and the felt main pulse is
  the unambiguous signature of compound feel; binary songs (4/4) are dominated by the 2×
  (eighth) and 4× (sixteenth) subdivisions, so the margin is huge and false positives are
  unlikely. Validated: "Gabriela Rocha - Atos 2" → 6/8 (ternary ≫ binary); a 4/4 control →
  ternary strongly negative, binary ≈ 1.0.
- **How to apply:** for compound, the click grid becomes the **eighth-note pulse (6 per
  bar)** and `beatsPerBar` maps `6/8 → 6`. Build it as a **CLEAN CONSTANT-TEMPO grid**
  (see "Compound = constant grid" below), NOT from tracked/subdivided beats. The double-time
  halving safety net does NOT run on the compound branch (it is for binary double-time only).

## Compound = constant onset-phase-locked grid (NOT tracked/subdivided)
For the slow 6/8 (~53 BPM dotted-quarter) the tracked beats are unusable for the metronome:
`beat_track` is jumpy at that tempo, and subdividing each gap into 3 eighths AMPLIFIES the
jitter — the eighth grid swung ±0.4 s (residual std ~0.41 s, >1 whole eighth) around the true
constant tempo. Using those beats directly made the click sound irregular and read as
drifting (user: "começou certo, porém depois ficou atrasado"). A constant grid from an
imprecise interval + single-beat phase failed the other way ("à frente").
**The fix (compound branch): build a regular grid from a PRECISE constant tempo + an
ONSET-ENERGY-LOCKED phase, covering t≈0 → end.**
- **Tempo:** parabolic-interpolate the main-pulse autocorrelation peak (`best_lag`) for
  sub-frame precision, then `eighth = (lag/frate)/3`. Cross-validated three ways on Atos 2:
  large-lag slopes (158.14–158.20), autocorr (158.10), robust linear fit — all ≈158.1 BPM
  (interval ≈0.3795 s). The robust LINEAR fit's by-third residuals were FLAT
  ([-0.004,-0.105,0.02]) → the song is genuinely constant tempo; the std is pure jitter.
- **Phase:** scan offset in `[0, eighth)` and pick the one MAXIMIZING summed `onset_env` at
  grid frames, **restricted to the groove region** (`t ≥ p_start` when there's a pad intro,
  else whole song). This aggregates all onsets so it is robust to per-beat jitter (vs
  anchoring to one tracked beat, which sat early or late).
- **Why constant is correct here:** the user literally wants "um tempo que se sustenta a
  música inteira"; studio recordings hold tempo. A regular grid from ~0 also clicks from the
  start with zero drift, so no separate intro extension is needed on the compound branch.
- **Scope:** this constant-grid rebuild is COMPOUND-ONLY. Simple-meter songs keep their
  tracked beats (which follow tempo and have no subdivision jitter) — don't force a constant
  grid on them or you risk regressing variable-tempo/live tracks.

## The server emits only `"6/8"` or `null` — never `"3/4"`/`"4/4"`
Simple-meter classification (3/4 vs 4/4) on the server is **fragile and octave/hint
dependent** — the same control track flipped 4/4↔3/4 just by changing the BPM hint.
So the server returns `null` for simple meters and lets the client's upload analysis
(`initialTimeSignature`) keep deciding 3/4 vs 4/4 exactly as before.
- **Why:** adding 6/8 must not regress the already-working simple-meter UX. Returning a
  forced "4/4" would also override a correct client "3/4".
- **How to apply:** only add NEW capability (compound) at the server; never relabel what
  already works. `server.meter ?? initialTimeSignature` is the precedence.

## Non-percussive intro — re-phase the grid to the groove, keep clicking from t≈0
**(SIMPLE-meter branch only — compound now covers t≈0→end via its constant grid above.)**
Many songs (worship especially) open with 10-20s of pad/voice and **no percussion**.
That rubato intro **contaminates the global beat_track fit** (its phase ends up ~0.1s
off the real groove). The user wants the metronome to click **from the very start** but
in the tempo/phase dictated by the drums — NOT silent through the intro (we tried the
silent-intro version first; user explicitly rejected it: "quero que comece desde o início").
So `detect_beats.py` finds where percussion enters, measures tempo+phase **there**, and
**rebuilds the whole grid as a regular series extended back to ~0** through a solid groove beat.
- **How it's detected:** HPSS percussive component (`librosa.effects.percussive`), then its
  smoothed RMS; percussion "enters" at the first frame whose ~1.5s sustained window stays
  above 0.2×(p95 of the RMS). Only re-phase if that start is >~2s in AND ≥4 groove beats remain;
  wrapped in try/except so a separation failure just keeps the global grid.
- **DON'T rebuild the whole grid synthetically.** A first attempt replaced every beat with a
  fixed-interval series `first + interval*arange(n)` from one anchor. It drifted: a sub-ms
  interval error accumulates over hundreds of beats and the click is audibly "à frente" by
  ~2-3min in. The tracked `beat_track` beats follow the song's real onsets and DON'T drift —
  never throw them away. **Keep the real groove beats; only extrapolate the intro.**
- **Correct extension:** keep `groove = beats[beats>=p_start]` untouched (tracked, drift-free),
  compute the local interval from the first ~16 groove beats, and PREPEND synthetic beats
  stepping backward from `groove[0]` to ~0: `back = anchor - interval*arange(k,0,-1)` (k =
  floor(anchor/interval)), then `beats = concat(back, groove)`. Intro is rubato/no-beat so its
  fixed interval is fine and only ~18s long; the body stays locked to the tracked beats.
- **Why HPSS is required:** the intro still has harmonic/vocal onset energy, so the plain
  onset envelope can't tell "has a beat" from "no beat" — only the percussive component can.
  Validated: Atos 2 (drums enter ~18s) → grid starts 0.02s, interval 0.3793 (eighth), passes
  through 18.228s; a solo-piano hymn (attacks from start) → perc-start 0.9s, no re-phase.
  NOTE: piano note attacks read as percussive in HPSS, so this finds *drums/strong rhythm*,
  not literally "any percussion".
- **Client side needs nothing:** the metronome anchors to the `beats[]` map; a grid that
  already starts near 0 just clicks from the start at the groove's tempo/phase.

## Player gating
Playback is blocked until tempo/meter detection finishes: play button disabled +
spinner while `bpmDetecting`, plus a `bpmDetectingRef` guard inside `togglePlay`
(its deps are stable, so a ref mirror is needed). So the metronome never starts on a
wrong/empty grid.
