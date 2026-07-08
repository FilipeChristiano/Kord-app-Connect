---
name: Stem mixer playback (acordes)
description: Why the máxima-qualidade fader streams two <audio> elements instead of decoding Web Audio buffers
---

# Stem mixer playback (mesa de mistura)

The "máxima qualidade" panel is ONE player ("Mesa de mistura") that plays vocals +
instrumental together with TWO independent volume faders (Voz / Instrumental, both
default 100%). Play it by **streaming two HTMLAudioElements**, not by decoding Web
Audio buffers.

**Rule:** each stem is its own `<audio>` with `.volume` = its fader (0–1). One
element is the master clock (instrumental); keep the other (vocal) aligned with
drift correction on the master's `timeupdate`.

**Drift correction must NOT hard-snap the audible stem.** The original code did
`vocal.currentTime = inst.currentTime` whenever drift > ~0.12s. Seeking a *playing*
media element causes a brief stall/silence — inaudible while both stems play, but
with the voice ISOLATED (instrumental fader at 0) every snap is an audible cut
("vários cortes"). Fix: correct drift by nudging `vocal.playbackRate` instead:
- deadband ~0.035s → rate = 1 (in sync);
- between deadband and ~0.35s → `playbackRate = 1 - clamp(drift*0.5, ±0.06)`
  (drift = vocal − inst; ahead → slow down, behind → speed up) so it re-converges
  continuously without a seek;
- only above ~0.35s (seek/jump level, already a discontinuity) → hard-snap
  `currentTime` and reset rate to 1.
Reset `vocal.playbackRate = 1` on pause, seek, play-start, and ended so a nudge
never persists. Tradeoff: tiny brief pitch wobble during correction, far less
objectionable than a cut. Both stems share identical length/encoding so corrections
stay small and rare.

**Why two faders not two players:** once both stems stream together, separate
"sem voz" / "voz em destaque" players are redundant — two faders on one player do
the same thing more clearly (user can isolate or balance either stem). The SAME
`StemMixer` is reused by BOTH modes: máxima qualidade feeds server stem URLs;
modo rápido generates both stems in-browser (vocals + instrumental workers →
WAV blob URLs) and feeds those. `StemMixer` takes a `downloadExt` prop ("mp3" for
server, "wav" for in-browser blobs).

**Seeking needs HTTP Range:** the `<audio>` master-clock can only fast-forward to
unbuffered positions if the source supports `206`/`Content-Range`. The
`/api/stems/file` route MUST honor `Range` (it didn't at first → "não deixa
adiantar a música"). Blob URLs (modo rápido) seek natively, no server needed.

**Per-flow run-id tokens:** fast mix, máxima qualidade, and the legacy vocals flow
each need their OWN run-id ref (`fastRunIdRef`/`hqRunIdRef`/`stemRunIdRef`). A
single shared token meant switching modes mid-run invalidated the other flow,
leaving its busy/preparing flag stuck (state updates are guarded by
`if (ref.current === runId)`). Global cancel points (unmount, clearStems) bump ALL
tokens.

**formatClock decimals:** floor the seconds (`Math.floor(safe % 60)`) — raw
`currentTime`/`duration` are floats and otherwise render as `0:10.292473`.

**Why:** the first implementation used `fetch().arrayBuffer()` +
`decodeAudioData()` on BOTH stems before playback. Each stem mp3 is ~7–10MB; the
double decode is slow to start and the PCM blowup (~80–160MB) failed on some
devices (user reported "demorando" + "deu erro"). Streaming starts instantly and
keeps memory low.

**How to apply:** any multi-stem playback in this app — prefer streaming media
elements over full buffer decode. Reserve Web Audio buffers for short clips or
when sample-accurate scheduling is truly required.

## Rule: tempo identification must run on the ORIGINAL full mix, never on a separated stem
The mixer's BPM/phase detection (analyzeBpm) must analyze the original uploaded
song (`sourceFile` prop), not the separated instrumental. Separated stem is only
a fallback when the original is unavailable.
**Why:** separation (center-extraction DSP and even Demucs mp3) attenuates/alters
kick and bass, so detection on the stem picked wrong BPM and locked the click on
the offbeat ("contratempo"), while the standalone Metronome — which analyzes the
full mix — was perfect on the same song.
**How to apply:** any tempo/beat analysis in the stem mixer should decode ONE
buffer (the original mix — same cost as decoding one stem) and feed the same
detector chain the Metronome module uses; playback stays streaming.

## Rule: mixer click anchors ONLY on analyzeBpm's segment beat — no extra phase stages
The mixer grid is the Metronome module's result verbatim: constant pulse with
offset = (segment.start + option.phaseSec) mod T, extended over the whole song.
Do NOT re-estimate phase with a second pass (whole-track grid recompute, server
beat tracking, circular-mean phase, etc.).
**Why:** every extra "refinement" stage recalculated the phase over material the
detector didn't pick and repeatedly overrode the good anchor — the user reported
offbeat/late clicks until all post-processing was removed; the module is judged
"perfect" precisely because it uses only the best-segment anchor. User explicitly
asked: analyze whole song, pick the easiest segment, use that BPM everywhere.
**How to apply:** on option switch, reuse that option's phaseSec from the same
segment (synchronous, no re-analysis). If precision complaints return, tune the
detector itself (lib/bpm-detector), never re-add a phase-override stage.

## Rule: octave/BPM options in Audio Lab mirror the Metronome, default stays upload-locked
The Audio Lab StemMixer exposes the same 3 tempo options as the standalone Metronome
(metade/principal/dobro from `analyzeBpm`). Selecting an option recomputes the beat grid
(`computeBeatGrid`) for that octave and re-syncs the click.
**Why:** users need to override a wrong auto-picked octave, but the octave must still
default to the tempo confirmed at upload (`initialBpm`) so nothing regresses silently.
**How to apply:** default the selected option to the octave nearest the upload BPM
(fallback `recommendedIndex`); on user selection REUSE the cached decoded AudioBuffer —
never re-run `analyzeBpm` per tap. Guard every grid recompute with an incrementing
`gridTokenRef` and bump the token in the detection effect's cleanup, so recomputes
in flight after unmount / song change are dropped (no setState-after-unmount).
