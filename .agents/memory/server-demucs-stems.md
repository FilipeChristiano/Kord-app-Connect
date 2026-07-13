---
name: Server Demucs stems (acordes "máxima qualidade")
description: Server-side high-quality vocal/instrumental separation pipeline — gotchas for demucs + ffmpeg.
---

The "máxima qualidade" audio-studio mode runs Demucs (htdemucs) on the api-server
as an async job (prepare → status → file polling), alongside the existing FAST
in-browser DSP separation. Per-song the user picks fast vs máxima.

## Gotchas (non-obvious, cost real time)
- **ffmpeg format inference fails on `.part` temp names.** Writing to
  `vocals.mp3.part` makes ffmpeg error "specify the format manually / Error
  initializing the muxer". Always pass `-f mp3` (or the explicit muxer) when the
  output filename does not end in a recognized extension. Applies to any
  write-to-temp-then-rename pattern.
- **demucs 4.0.1 has no `demucs.api`.** Use `demucs.pretrained.get_model` +
  `demucs.apply.apply_model` + `demucs.audio.AudioFile`; save stems with soundfile.
- **The demucs CLI cannot save output in this env** — torchaudio now routes saves
  through torchcodec (not installed): `ImportError: TorchCodec is required`. For any
  ad-hoc separation, run `artifacts/api-server/scripts/separate_stems.py <in> <out_dir>`
  (saves via soundfile); a 30s clip finishes in well under 2 min in the foreground.
- **Backgrounded shell jobs die between agent bash sessions** even with
  setsid/nohup/disown — don't rely on them for long processing; run in the
  foreground within the tool timeout or via a workflow.
- **Full-song separation is NOT real-time on 2 CPUs.** Expect ~5-6 min wall time
  for a ~3.5 min song (model load + inference + transcode), not the ~real-time a
  short 30s clip suggests. Keep the job timeout generous (12 min) and the UI copy
  honest ("pode levar alguns minutos"). First run also pays model-weight download.

## CPU-only torch (deploy size)
- The env has NO GPU. Pin torch + torchaudio to the CPU index
  (`https://download.pytorch.org/whl/cpu`) or the lock pulls the full nvidia/CUDA
  chain (~several GB, 60+ lock refs) that just bloats the deploy.
- **uv gotcha:** `[tool.uv.sources]` is only honored for *direct* project
  dependencies. torch/torchaudio come in transitively via demucs, so the CPU pin
  is ignored until you also list `torch` + `torchaudio` in `[project].dependencies`.
  Then `uv lock` resolves them as `X.Y.Z+cpu` and drops every nvidia package.

## Resource hygiene (must keep)
- Uploaded source files (`<key>.src`) MUST be deleted after the job (success or
  failure) — pass a cleanupSource flag through the job runner's `finally`.
- Stem cache needs bounded retention (TTL + LRU dir cap) or `/tmp` fills up.
  Prune opportunistically on each prepare; also sweep orphan `.src`/`.work`.
- YT-sourced audio is shared/cached and must NOT be deleted by the stems job.
