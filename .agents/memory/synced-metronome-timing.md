---
name: Synced metronome timing (acordes)
description: How the embedded mixer metronome stays locked to the song and survives UI jank
---

# Embedded metronome timing (StemMixer / Audio Lab)

`useSyncedMetronome` (in `use-metronome.ts`) plays clicks in sync with a playing
`<audio>` element (the instrumental, used as master clock in StemMixer).

## Rule: schedule from a stable anchor on the AudioContext clock, not from live media currentTime
Establish an anchor mapping (songPos ↔ ctx.currentTime) once on start, derive
every beat's play time from that anchor, and only re-anchor when real drift/seek
is detected. Track an absolute `nextBeat` index; skip already-past beats.

**Why:** the original engine recomputed each click as
`ctx.currentTime + (beatSongTime - getPosition())` on *every* scheduler tick.
`HTMLMediaElement.currentTime` jitters and the main thread stalls during volume
fader drags, so each click's scheduled time shifted — audibly off-tempo and
"losing sync when changing volumes." Anchoring to the audio hardware clock makes
the beats immune to media jitter and JS-timer jank.

**How to apply:**
- Re-anchor gently (keep beat counter, just realign mapping) when |actual − predicted| > ~45ms.
- Hard re-anchor (recompute nextBeat from new position) on jumps > ~0.4s (seek/pause-resume) and on BPM change.
- Schedule ~250ms ahead (SYNCED_SCHEDULE_AHEAD) so a delayed scheduler tick never drops a beat — the clicks are already committed to the AudioContext.
- Volume changes must ONLY touch the master GainNode (setTargetAtTime); never restart or reset the scheduler.

## Rule: a stable AudioContext anchor is necessary but NOT sufficient — you also need PHASE and a PRECISE (non-integer) BPM
Anchoring fixed the jitter/jank, but the user still reported "fora do tempo." Two
remaining causes:
- **Phase:** beats land at `beatOffsetSec + n·secPerBeat`, not `n·secPerBeat`.
  Real songs have an intro/pickup, so beat 1 is almost never at song-time 0.
  Without the offset the clicks sit a constant fraction-of-a-beat off — sounds
  off-tempo even when the BPM is right.
- **Drift:** a rounded integer BPM accumulates error. ~0.5 BPM off at 75 BPM
  drifts ~2s over a 5-min song, so the click slides out of time by the end.

**Fix:** `computeBeatGrid(buffer, bpmHint?, tsHint?)` in `bpm-detector.ts` fits a
global grid (precise float BPM + phase) to the onsets of the WHOLE instrumental:
search ±1.2% around the hint × 48 phase positions, score by proximity-weighted
matched onset strength so the winning BPM is the one that stays aligned to the
END of the track. Returns `{bpm (float), bpmRounded, beatOffsetSec, timeSignature}`.

**How to apply:**
- StemMixer ALWAYS analyzes the actual instrumental stem that plays (the stem
  starts at t=0 same as playback, so the phase maps directly to its currentTime).
  The upload-analysis BPM is passed only as `bpmHint` to fix the octave/meter.
- Feed the precise float BPM (not rounded) to the engine; only `Math.round` for
  display. `useSyncedMetronome` takes `beatOffsetSec` and re-anchors when phase
  OR bpm changes; `nextBeat = ceil((songPos − offset)/secPerBeat)`.

## Mixer metronome is locked + unaccented (product decision)
In StemMixer the BPM is display-only (cravado to detected tempo, no -/+ edit) and
every beat is `playClick(..., "weak")` — no strong downbeat. The standalone
Metrônomo page uses the separate `useMetronome` engine and KEEPS its accents.

## HMR caveat
Adding/removing a hook in StemMixer/useSyncedMetronome throws "Rendered more/fewer
hooks than during the previous render" on hot-update — it's HMR-only; a full
workflow restart + fresh load clears it. Don't chase it as a real bug.
