---
name: Real piano playback (acordes)
description: How chord playback stays in sync with the keyboard diagram and sample range constraints
---

**Rule:** Chord audio must use the exact same voicing logic as the visual diagram: `placeNotes` from `lib/notes.ts`, with diagram octave 0 anchored to C3 (MIDI 48). LH default base octave 0 (1 only for "Mão Esquerda — Fechado"), RH base octave 1.

**Why:** Users compare what they hear with the dots on the keyboard SVG; any divergent octave math makes the sound "wrong" versus the diagram. This logic was previously duplicated in PianoKeyboard and chord-detail — it now lives once in `lib/notes.ts` (shared by visuals and audio).

**How to apply:** Any new place that plays a chord (cards, panels, future modules) should call `playChordVoicing(leftHand, rightHand, {leftBaseOctave})` from `lib/piano.ts` — never re-implement note→MIDI. Salamander samples cover C3..C6 (minor thirds); pitch-shift stays ≤1 tone, so voicings above ~C#6 need new samples from tonejs.github.io/audio/salamander/.

Also: the AudioContext singleton + unlock listeners live in `lib/piano.ts`; hover-sounds and all playback share it. Chord playback has its own 250ms throttle separate from the hover throttle.
