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
