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
  bar)** and `beatsPerBar` maps `6/8 → 6`. Build that grid by **subdividing the felt main
  pulse into 3 equal eighths** — i.e. `track(main_bpm)` then insert 2 evenly-spaced points
  between consecutive beats. Do NOT re-run `beat_track(start_bpm=main_bpm×3)`: re-tracking
  at 3× locks onto a WRONG PHASE (first eighth landed ~0.35 s off the real pulse) and a
  slightly fast tempo (161.5 vs the true 158.2 = main×3), so the metronome started out of
  rhythm / rushing. Subdividing keeps the grid phase-locked (first eighth on the real pulse,
  downbeats on the felt pulse) and the tempo exactly 3×. The double-time halving safety net
  does NOT run on the compound branch (it is for binary double-time only).

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
- **Re-phase math:** `interval = median(diff(groove_beats))`, `anchor = groove_beats[0]`,
  `first = anchor - interval*floor(anchor/interval)` (first beat near 0 on the same phase),
  then `beats = first + interval*arange(n)` out to the old last beat. The grid passes exactly
  through `anchor`, so the groove is dead-on and the intro clicks are the backward extension.
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
