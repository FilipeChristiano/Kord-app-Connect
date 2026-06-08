---
name: Code review / validation uses cumulative git diff
description: Why architect/validation flags already-published prior-task work as scope violations in artifacts/acordes
---

# Code review & validation include the cumulative git diff

`architect({includeGitDiff:true})` and the `mark_task_complete` validation review the
**entire uncommitted/cumulative diff**, not just the files changed for the current task.

**Why:** In this repo, multiple feature tasks land between checkpoints. A scoped task
(e.g. a "visual-only redesign") will be marked Fail/Rejected because the diff still
contains earlier, already-approved-and-published work (the BPM detector rewrite in
`src/lib/bpm-detector.ts` + `src/components/bpm-detector.tsx`, and the pad-continuous
"Pads + cifras" mode) that the reviewer reads as out-of-scope logic changes.

**How to apply:** Do NOT revert that prior work to satisfy the review. Judge the review
only against the files you actually touched this task. Use `skip_validation_reason` /
explain to the user when the rejection is purely the reviewer conflating prior published
work with the current task. The BPM-detector spec used by validation is also stale and
contradicts the user's deliberate choices — never undo those.
