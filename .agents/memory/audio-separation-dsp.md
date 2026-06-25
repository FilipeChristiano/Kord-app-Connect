---
name: Audio separation DSP (acordes studio)
description: How the in-browser "sem voz"/"voz em destaque" effects work and the non-obvious constraints behind them
---

# In-browser vocal/instrumental separation (acordes audio studio)

Local DSP only — no paid/external service (user declined cost). It is an EFFECT,
not AI stem separation. Two code paths share one idea: separate the CENTER of the
stereo image (usually the vocal) from panned content.

## Core algorithm (offline, Web Worker)
`separateCore(ch, mode)` in `audio-dsp.ts` — STFT soft mask:
- per-bin `centerWeight = (panBalance * phaseAlign)^GAMMA * vocalBandWeight`, then
  smoothed across neighbor bins to cut musical noise.
  - `panBalance = 1 - |aL-aR|/(aL+aR)` → 1 when level-equal (center).
  - `phaseAlign = max(0, cos(phaseL - phaseR))` → rejects out-of-phase/decorrelated
    (reverb, wide stereo). Both terms needed: panBalance locates pan, phaseAlign
    rejects width. Either alone leaks.
- vocals = `mask*mid` (mono); instrumental = each channel `− mask*mid` → keeps
  STEREO and panned instruments (the old naive `(L−R)/2` collapsed to mono and
  cancelled centered bass/drums → that was the "instruments distorting" complaint).

## Live real-time path (`audio-live.ts`)
Real-time can't do STFT cheaply, so it uses a 2-band crossover (~180 Hz):
bass passes intact in stereo; only the mid/high band gets center-cancel
`(hpL−hpR)/2`.

**Why dry/wet crossfade instead of a single toggled crossover:** a Butterworth
`lowpass + highpass` at the same cutoff does NOT sum back to a flat/phase-correct
signal, so feeding the whole graph in "original" mode COLORS the audio even with
the effect off. Fix: keep a parallel pure DRY path and crossfade dry↔wet on
mode change (short `setTargetAtTime` ramp, anti-click). Original mode = 100% dry.

**How to apply:** if you ever route live playback through filters, never assume
`lp+hp == dry`. Provide a true dry path for the "off" state.

## Stereo plumbing
`DspResult.samplesR` carries the optional 2nd channel; `encodeWav` interleaves
when present (instrumental download is stereo, vocals stays mono). `stem-worker.ts`
takes a `mode` and transfers `samplesR` too. `isEffectivelyMono` (dual-mono guard)
throws `MonoSourceError` when L≈R since there is no center to separate.
