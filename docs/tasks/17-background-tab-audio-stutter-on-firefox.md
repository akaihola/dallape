As soon as I switch to another browser tab on Firefox, the audio starts to stutter. Chromium is ok.

Tracker: [the dallape tracker](../../TASKS.md).

## Execution record, 2026-10-24

Worked on the task branch rebased onto `main` at `d1e55ef` (the start move).

### Cause

[frontend/app.js](../../frontend/app.js) synchronizes the replacement `<audio>`
with the YouTube player every 250 ms. It seeks the replacement whenever it
differs from `player.getCurrentTime()` by more than 0.3 s; each seek briefly
restores the original sound.

The player's reported time comes from the embed iframe. The current
`www-widgetapi.js` (player `cbcfbf2f`) answers `getCurrentTime()` from the
iframe's last `infoDelivery` report, extrapolated by at most one second. The
embed sends those reports from the player's `onVideoProgress`, which the
media element's `timeupdate` drives.

While the replacement plays, the YouTube player is muted. In a background
tab, Firefox throttles that muted cross-site iframe. In the reproduction
below, reports arrived seconds apart and the player's own position fell
behind. The reported time froze or lagged, so every tick found more than 0.3 s
of drift and seeked the replacement back to the same point. That repeating
seek, pause and restore is the stutter. Chromium exempts an audible page from
background throttling, which matches the report that Chromium is unaffected.

### Firefox reproduction

A diagnostic harness drove the real YouTube embed (`dQw4w9WgXcQ`) and this
frontend in Playwright's Firefox 1543 build over WebDriver BiDi, headless. A
local server supplied a generated Opus tone through the audio API. The
harness ran 15 s in the foreground with the replacement active, 30 s with
another tab active, then 10 s back in the foreground.

Limits of the harness:

- The sandbox has no audio device, so Firefox fails an audible element's
  sink. The YouTube player was muted before selection, so the replacement
  played muted, as the app preserves the original mute state.
- Headless Firefox throttled the background tab but kept it `visible`. The
  harness reported `document.hidden` as true while the other tab was active,
  as a headed Firefox does.
- The harness lives outside the repository: it depends on live YouTube and
  the sandbox's network proxy.

| Phase | Frontend | Replacement seeks | Pauses | Longest report gap |
| --- | --- | --- | --- | --- |
| Foreground | unpatched `main` | 0 | 0 | 298 ms |
| Background | unpatched `main` | 46 | 32 | 3034 ms |
| Foreground again | unpatched `main` | 0 | 0 | 298 ms |
| Foreground | patched | 0 | 0 | 305 ms |
| Background | patched | 0 | 0 | 2023 ms |
| Foreground again | patched | 0 | 0 | 292 ms |

In an earlier unpatched run, one report gap covered 4.08 s of wall time while
the player advanced 0.28 s. Meanwhile, `getCurrentTime()` stayed at the
extrapolation cap, and the replacement was seeked back to 20.539 s every
~0.5 s. In the patched run, the first visible tick found the replacement
within 0.3 s of the player, so no resynchronization was needed.

### Change

- `syncAudio` in [frontend/app.js](../../frontend/app.js): while
  `document.hidden` is true and the replacement is active and playing, it uses
  the replacement's own position instead of the player's. Pausing and ending
  still stop it. A stopped replacement starts again at the player's position,
  and a visible page follows the player as before.
- [frontend/tests/app.test.js](../../frontend/tests/app.test.js): a hidden-page
  regression test. It fails on the unpatched `app.js` (the replacement is
  seeked to the lagging 0.5 s).
- [docs/audio-contract.md](../../docs/audio-contract.md#playback-and-retry):
  documents the hidden-page behavior.

### Checks before merge

- `node --test frontend/tests/*.test.js`: 40 passed, 0 failed.
- `uv run --frozen pytest -q` from `backend/`: 70 passed, with the known
  Starlette `BlockingPortal` deprecation warning.
- `python3 tools/check_tasks_md.py TASKS.md`: passed.
- The Firefox harness results above.

### Not done

- Not deployed. Deployment runs from `akaihola@atom`, so the live site keeps
  the stutter until the image is rebuilt and redeployed.
- Not checked in a headed Firefox with audio output on a real tab switch.

### Guarded command resource record

All commands started at once, with no wait.

| Command | Admission | Final | Start swap | Swap growth | Elapsed | Exit |
| --- | --- | --- | --- | --- | --- | --- |
| Playwright Firefox probe, `probe1.py` | 10337 MiB | 10194 MiB | 1010 MiB | 0 MiB | 2 s | 1 (missing `libstdc++`) |
| Playwright Firefox probe, `probe1.py` | 10188 MiB | 10663 MiB | 1010 MiB | 0 MiB | 34 s | 0 |
| Playwright Firefox probe, `probe2.py` | 10490 MiB | 10469 MiB | 1004 MiB | 0 MiB | 8 s | 0 |
| BiDi harness, `main` frontend, setup run | 10452 MiB | 10386 MiB | 1004 MiB | 0 MiB | 2 s | 1 |
| BiDi harness, `main` frontend, setup run | 10395 MiB | 10503 MiB | 1004 MiB | 0 MiB | 63 s | 1 |
| BiDi harness, `main` frontend, setup run | 10486 MiB | 10190 MiB | 1004 MiB | -1 MiB | 63 s | 1 |
| BiDi harness, `main` frontend, setup run | 10276 MiB | 10369 MiB | 1003 MiB | -1 MiB | 63 s | 1 |
| BiDi harness, `main` frontend, setup run | 10388 MiB | 10734 MiB | 1002 MiB | 0 MiB | 37 s | 1 |
| BiDi harness, `main` frontend, setup run | 10735 MiB | 10699 MiB | 1002 MiB | 0 MiB | 36 s | 1 |
| BiDi harness, `main` frontend, setup run | 10551 MiB | 10319 MiB | 1002 MiB | 0 MiB | 36 s | 1 |
| BiDi harness, `main` frontend, setup run | 10256 MiB | 10762 MiB | 1358 MiB | -2 MiB | 36 s | 1 |
| BiDi harness, `main` frontend, setup run | 10461 MiB | 10186 MiB | 1355 MiB | 295 MiB | 300 s | 124 (timeout) |
| BiDi harness, `main` frontend, setup run | 10711 MiB | 10647 MiB | 1649 MiB | 0 MiB | 42 s | 1 |
| BiDi harness, `main` frontend, without emulated hiding | 10693 MiB | 10609 MiB | 1649 MiB | -13 MiB | 62 s | 0 |
| BiDi harness, `main` frontend | 10302 MiB | 9989 MiB | 1628 MiB | 0 MiB | 62 s | 0 |
| BiDi harness, patched frontend | 9988 MiB | 10224 MiB | 1628 MiB | 0 MiB | 63 s | 0 |
| `node --test frontend/tests/*.test.js` | 10323 MiB | 10228 MiB | 1619 MiB | 0 MiB | 2 s | 0 |
| `uv run --frozen pytest -q` in `backend/` | 10223 MiB | 10106 MiB | 1619 MiB | 0 MiB | 4 s | 0 |

One BiDi setup run, between the 300 s timeout and the next guarded run, ran
without the guard, under `timeout 200`. It ended with exit 1 after about
30 s. MemAvailable was above 9.9 GiB before and after the guarded runs on
either side. The red check of the new test against the unpatched `app.js` and
the tracker check are short, light commands and also ran without the guard.

### Checks at the merged commit

Merged into `main` as a fast-forward from `d1e55ef` to `3d75633`. Recorded
with `check-evidence.py record` from the task worktree detached at `3d75633`;
receipt: [the evidence file](17-background-tab-audio-stutter-on-firefox.evidence.json).

- **frontend-tests:** `node --test frontend/tests/*.test.js`: pass, exit 0
  (40 passed).
- **backend-tests:** `cd backend && uv run --frozen pytest -q`: pass, exit 0
  (70 passed, one known deprecation warning); `backend/uv.lock` sha256
  `8375ce45…`.
- **tasks-md:** `python3 tools/check_tasks_md.py TASKS.md`: pass, exit 0.

Memory reports for the record calls; each started at once, with no wait:

| Check | Admission | Final | Start swap | Swap growth | Elapsed | Exit |
| --- | --- | --- | --- | --- | --- | --- |
| frontend-tests | 9953 MiB | 9821 MiB | 1619 MiB | 0 MiB | 2 s | 0 |
| backend-tests | 9821 MiB | 9715 MiB | 1619 MiB | 0 MiB | 2 s | 0 |
| tasks-md | 9715 MiB | 9842 MiB | 1619 MiB | -1 MiB | 2 s | 0 |
