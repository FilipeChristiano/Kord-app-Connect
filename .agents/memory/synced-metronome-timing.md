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

## Rule: a constant "click slightly AHEAD of the music" is a latency mismatch, not a grid error — needs a per-device sync offset
After anchor + phase + precise BPM, the user still heard the click a CONSTANT
small distance ahead the whole song (not drifting). Cause: the instrumental
streams through an `<audio>` (HTMLMediaElement) whose output path has more
latency than the Web Audio click; anchoring `audio.currentTime ↔ ctx.currentTime`
assumes both = "now", so the ctx-scheduled clicks land ahead of the heard music
by `L_media − L_ctx`.

**Superseded fix (kept as a fallback micro-adjust):** `syncOffsetSec` in
`SyncedMetronomeConfig` — positive value delays the click (`ctxTime += syncOffset`).
Still exposed as a persisted "Ajuste fino do clique" −/+/Padrão control, but the
DEFAULT is now **0** and the localStorage key was bumped to `harmonic.metroSync2`
(old `+0.08` values would be wrong on the new path — see next rule).

**How to apply (general to the synced engine):**
- Treat any re-anchor (BPM/phase/sync change OR seek) as needing a one-lookahead
  **hold**: set `holdUntil = ctxNow + SYNCED_SCHEDULE_AHEAD` and skip scheduling
  new beats before it. Already-scheduled oscillators in the 250ms window can't be
  cancelled without a pop, so without the hold a live +/- press doubles/flams.
- Startup blip ("first click then a gap"): while `getPosition() <= 0.01` (media
  buffering pins currentTime at ~0 just after play()), keep re-anchoring and DON'T
  schedule. Scheduling only begins once position truly advances → no premature click.

## Rule: replicate the Metrônomo's precision by putting music AND clicks on ONE AudioContext (same clock)
The user pointed out the standalone Metrônomo's "Ouvir" preview is dead-on with no
calibration, and asked to replicate its play exactly. **Why it's precise:**
`startMetronomePlayback` (bpm-detector.tsx) plays the analyzed segment via a Web
Audio `BufferSource` and schedules the click oscillators on the SAME AudioContext —
so audio and click share one output path/clock and there is NO `L_media − L_ctx`
latency to compensate.

**The old "different origin → createMediaElementSource is silent" worry was WRONG
here:** stems are served same-origin via the `/api` proxy (`stemsFileUrl` returns
`/api/stems/file?...`), and `LiveStudioPlayer` (audio-live.ts) already routes a
streaming HQ `<audio>` through `createMediaElementSource` with no crossOrigin and no
silence. So routing the mixer through Web Audio is safe.

**Fix (current):** StemMixer builds ONE `AudioContext` lazily inside the play gesture
(`ensureAudioGraph`): each stem `<audio>` → `createMediaElementSource` → its own
`GainNode` (the faders; elements set to `.volume=1`) → destination. That same ctx is
handed to `useSyncedMetronome` via `getAudioGraph()`; the hook binds its click master
gain to it instead of creating its own ctx. Now the click rides the exact clock as
the music → default `syncOffsetSec = 0`, no per-device calibration needed.

**How to apply / gotchas:**
- `createMediaElementSource` can be created only ONCE per `<audio>`; on track change
  (`instrumentalUrl` effect cleanup) close the ctx and null the source/gain refs so a
  fresh graph is built. `useSyncedMetronome.start` re-binds when the shared ctx changes.
- The hook must NOT close a shared ctx (track it with `ownsCtxRef`); only the mixer
  (its creator) closes it.
- Faders drive the `GainNode.gain` (setTargetAtTime) once the graph exists; before
  first play they fall back to `el.volume`. Do NOT keep both — double attenuation.
- Do NOT go back to buffer-decoding both stems (see stem-mixer-playback.md — OOM).
  MediaElementSource keeps streaming; only the routing changed.

## Rule: Audio Lab metronome uses the SAME client constant-grid engine as the Metrônomo — NOT a variable beat-map
Two beat-map attempts have now been tried and BOTH REVERTED because the user judged
them worse than the clean constant pulse:
1. SERVER beat-map (`/stems/beats` → librosa `beat_track`, variable instants) —
   mis-locked (double-time/"contratempo", tempo wander).
2. CLIENT DP beat-map (`computeBeatMap`, Ellis 2007 DP over onsets, seeded/octave-
   locked to the confirmed BPM) — added to follow songs that "breathe"; user tested
   and said "Piorou! Volte da forma que estava antes." Reverted; `computeBeatMap`
   deleted from `bpm-detector.ts`.

So Audio Lab's StemMixer uses `computeBeatGrid(instrumental, bpmHint, tsHint)` →
CONSTANT BPM + phase grid, `metroBeats=null` (constant mode in `useSyncedMetronome`).

**Why:** the user consistently prefers a clean, steady constant pulse locked to the
confirmed BPM octave over beat-tracking that follows local tempo. Even a
technically "human-like" tracker felt worse to them. Two engines behaving
differently was itself an earlier complaint.

**How to apply:**
- Do NOT reintroduce a variable beat-map (server `/stems/beats` OR a client DP
  tracker) into Audio Lab. The user has rejected BOTH. Only revisit if they
  EXPLICITLY ask for beat-tracking again after this.
- If the constant grid feels imprecise, prefer improving tempo IDENTIFICATION /
  grid precision over switching to beat-tracking.
- The old server-side double-time/octave-fold logic still lives in `detect_beats.py`
  but is dead for Audio Lab.

### Sub-rule: identify the tempo by mapping the INSTRUMENTAL with `analyzeBpm` first, then fit the grid
Passing only the upload's `initialBpm` as the `computeBeatGrid` hint was imprecise:
the grid just searches ±1.2% around a BPM detected from the ORIGINAL MIX (vocals +
everything), which can be off by more than that window on the clean instrumental.
The user asked for "a identificação mapeie a música toda antes de definir o tempo
do click, da mesma forma que acontece no módulo Metrônomo."

**Fix (current):** StemMixer runs the SAME detector the Metrônomo uses,
`analyzeBpm(instrumentalBuffer)`, to identify the tempo from the actual instrumental,
picks the octave option (metade/principal/dobro) CLOSEST to the confirmed
`initialBpm` (so the user's octave choice is respected, never re-guessed), and feeds
THAT bpm + its time signature into `computeBeatGrid` for the precise float BPM +
phase over the whole track.

**Why:** the instrumental (no vocals) gives a cleaner onset envelope than the mix,
so its own `analyzeBpm` reading is more accurate; centering the grid's ±1.2% window
on that value fixes the drift instead of locking to a possibly-wrong mix hint.
**How to apply:** keep the octave locked to `initialBpm` (nearest option), fall back
to the plain `initialBpm` hint if `analyzeBpm` returns no options.

## Mixer metronome is locked + unaccented (product decision)
In StemMixer the BPM is display-only (cravado to detected tempo, no -/+ edit) and
every beat is `playClick(..., "weak")` — no strong downbeat. The standalone
Metrônomo page uses the separate `useMetronome` engine and KEEPS its accents.

## HMR caveat
Adding/removing a hook in StemMixer/useSyncedMetronome throws "Rendered more/fewer
hooks than during the previous render" on hot-update — it's HMR-only; a full
workflow restart + fresh load clears it. Don't chase it as a real bug.
