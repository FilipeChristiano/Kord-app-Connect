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

## Player gating
Playback is blocked until tempo/meter detection finishes: play button disabled +
spinner while `bpmDetecting`, plus a `bpmDetectingRef` guard inside `togglePlay`
(its deps are stable, so a ref mirror is needed). So the metronome never starts on a
wrong/empty grid.
