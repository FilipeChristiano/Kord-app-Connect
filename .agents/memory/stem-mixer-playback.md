---
name: Stem mixer playback (acordes)
description: Why the máxima-qualidade fader streams two <audio> elements instead of decoding Web Audio buffers
---

# Stem mixer playback (fader)

The "máxima qualidade" panel lets the user fade the other stem back in (voice over
instrumental, or instrumental over voice). Play it by **streaming two
HTMLAudioElements**, not by decoding Web Audio buffers.

**Rule:** base element at `.volume = 1`, the "add" element's `.volume` is the fader
(0–1). Keep them aligned with light drift correction: on the base element's
`timeupdate`, if `Math.abs(add.currentTime - base.currentTime)` exceeds ~0.12s,
snap `add.currentTime = base.currentTime`. Both stems share identical length and
encoding (same htdemucs→ffmpeg mp3), so this stays tight.

**Why:** the first implementation used `fetch().arrayBuffer()` +
`decodeAudioData()` on BOTH stems before playback. Each stem mp3 is ~7–10MB; the
double decode is slow to start and the PCM blowup (~80–160MB) failed on some
devices (user reported "demorando" + "deu erro"). Streaming starts instantly and
keeps memory low.

**How to apply:** any multi-stem playback in this app — prefer streaming media
elements over full buffer decode. Reserve Web Audio buffers for short clips or
when sample-accurate scheduling is truly required.
