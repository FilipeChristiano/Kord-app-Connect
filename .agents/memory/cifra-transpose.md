---
name: Cifra transposition (acordes)
description: How chord transposition + key detection for the cifra works and the constraints that keep it correct.
---

# Cifra transposition / "mudar o tom" (artifacts/acordes)

All chord theory lives in `src/lib/chord-transpose.ts` so the cifra renderer
(`ChordSheet` in audio-lab.tsx) and the transpose feature share ONE classifier.
`classifyLine`/`isChordToken` were moved here out of audio-lab.tsx.

**Constraints that must hold:**
- Transpose only chord lines + `[Section] chords` inline lines — NEVER lyric/tab/
  annotation lines (a lyric word like "A" would otherwise be shifted). Alignment
  is preserved by re-placing each chord at its original column, pushing right only
  on overlap.
- `transpose` state is a semitone offset over `baseKeyName`; the chart string
  (`chart`) is never mutated by transposing. `displayChart` is derived. Copy and
  "Sofisticar" use `displayChart`, not `chart`.
- Entering edit mode while transposed BAKES `displayChart` into `chart`, sets
  `baseKeyName = currentKeyName`, resets `transpose=0` — otherwise edits + offset
  double-shift.

**Why client-side key detection:** YouTube-identified cifras frequently arrive
with `key: null` (CifraClub omits the Tom). `baseKeyName` is seeded on every cifra
load from `cifra.key ?? detectKeyFromChart(body)`.
`detectKeyFromChart` is QUALITY-AWARE (diatonic triad root+quality, not just root)
+ first/last-chord tonic bonus. Root-only scoring was wrong: it picked C major for
a G-major song because a D-major chord (non-diatonic to C, would be Dm) wasn't
penalized. Keep the quality check.
