---
name: librosa/numba JIT cache in Replit
description: librosa's first run is very slow (numba JIT ~2min) and the cache must point to a writable dir, else every request recompiles.
---

# librosa + numba JIT cache pitfall

The first invocation of any librosa pipeline (HPSS, CQT, beat_track) triggers
numba JIT compilation that can take **~1m45s** wall time. Subsequent runs are
fast **only if** the compiled cache persists.

**Pitfall:** numba's default cache lives next to the installed library, which in
Replit's Nix store is **read-only** → caching silently fails and *every* request
pays the full ~2min compile.

**Why:** the Python packages live in `.pythonlibs` / Nix store; numba can't write
its `__pycache__` there.

**How to apply:** when spawning any librosa/numba script (e.g. the `/api/chords`
chord analyzer), set `NUMBA_CACHE_DIR` (and `MPLCONFIGDIR`) to a writable path
under the workspace root (e.g. `<root>/.cache/numba`). Pre-warm the cache once
with a tiny clip after install. Give the spawning route a generous timeout
(≥4 min) so the first cold request in a fresh deploy doesn't get killed before
the JIT cache warms.
