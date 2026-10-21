Steward issue, 2026-10-21 12:09 refill. Goal: music (dallape is tier 3 in `<steward-vault>/Goals.md`). Estimated 1.5 h.

[The architecture re-check of 2026-10-21](../reviews/2026-10-21-architecture-recheck.md) ([12]) found N1, a P1 product failure: when source-buffer creation, append or decode, the media element or play fails before the end of the response, the frontend deletes the incomplete track and aborts its otherwise valid download. A retry repeats the same streaming path, so a repeatable early failure never reaches a completed Blob or a download. The re-check ranks it first in "Do these three first"; no open issue owns it.

## What to do

Separate attachment failure from transfer failure in `frontend/app.js`. Restore the original sound and detach the failed playback; keep the current transfer within the existing cache limits, stop retrying the failing streaming attachment for that attempt, and allow a completed-Blob retry or download-only use. Keep cancellation on navigation, format retirement, integrity failure and budget overflow. Reuse the existing test seam and update the fallback contract in `README.md`.

## Constraints and acceptance

- With a supported MIME type and only part of the response received, inject buffer-creation, append, asynchronous decode, media and play failures. The original audio remains audible; the rest of a valid response reaches a clean end and exposes the exact downloadable bytes without another network request.
- An explicit completed-Blob retry plays when the decoder supports it; otherwise the file stays downloadable. Repeat with an unknown Content-Length and with a slow local test response whose end arrives after the playback failure.
- Navigation and cache pressure still release retired resources; malformed or truncated transfers never expose downloads. Existing ownership, byte-budget and stale-callback regressions pass, and so do `node --test frontend/tests/*.test.js`, the backend suite and `tools/check_tasks_md.py`.
- Local fixtures only: no live YouTube request, deployment or image build.
- Memory: before each command, wait up to 10 minutes for `MemAvailable` of at least 2 GiB; if it doesn't come, start the command anyway when at least 1.5 GiB is available. Stop a running command when `MemAvailable` falls below 1 GiB or swap grows by more than 512 MiB. Run one heavy command at a time, and bound any background job you start.
- Under N1 in the re-check, add one line: "Fixed by [N]", with this issue's number.
