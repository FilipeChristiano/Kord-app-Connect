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
element is the master clock (instrumental); keep the other aligned with light drift
correction: on the master's `timeupdate`, if `Math.abs(other.currentTime -
master.currentTime)` exceeds ~0.12s, snap `other.currentTime = master.currentTime`.
Both stems share identical length and encoding (same htdemucs→ffmpeg mp3), so this
stays tight.

**Why two faders not two players:** once both stems stream together, separate
"sem voz" / "voz em destaque" players are redundant — two faders on one player do
the same thing more clearly (user can isolate or balance either stem).

**Why:** the first implementation used `fetch().arrayBuffer()` +
`decodeAudioData()` on BOTH stems before playback. Each stem mp3 is ~7–10MB; the
double decode is slow to start and the PCM blowup (~80–160MB) failed on some
devices (user reported "demorando" + "deu erro"). Streaming starts instantly and
keeps memory low.

**How to apply:** any multi-stem playback in this app — prefer streaming media
elements over full buffer decode. Reserve Web Audio buffers for short clips or
when sample-accurate scheduling is truly required.
