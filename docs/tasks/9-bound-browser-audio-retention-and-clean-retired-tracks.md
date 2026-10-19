---
depends-on: [4, 5]
---

# Bound browser audio retention and clean retired tracks

Steward proposal from HAI-3, 2026-10-19. Goal: music; dallape is tier 3. Promotion and implementation remain for the steward to choose.

See [the architecture review](../2026-09-19-architecture-review-and-remediation-plan.md#status-2026-10-19), remediation step 6.

Original step 6, F7. All visited videos, chunks and object URLs are still retained. Keep tab-local caching; no persistence layer is needed.

## Acceptance criteria

- Define a configurable byte/video budget and eviction or explicit clearing policy; application-owned retained bytes stay within it across more videos than the cap.
- Abort unwanted requests, detach callbacks/buffers, revoke retired Blob/MediaSource URLs and release redundant chunks safely.
- Active playback and download URLs stay valid, evicted tracks refetch, and stale callbacks cannot change current audio.
- Check cleanup through success, error and abort, and supplement ownership assertions with browser memory observation without requiring particular garbage-collector timing.
- README states that fetch-once applies only while a track remains retained; cleanup policy can be rolled back independently.

Memory (hopeli, steward 2026-10-19): before each browser or test command, wait up to 10 minutes for `MemAvailable` of at least 2 GiB; if it doesn't come, start anyway when at least 1.5 GiB is available. Stop a running check, and record it as unavailable, when `MemAvailable` falls below 1 GiB or swap grows by more than 512 MiB. Run one browser at a time.

## Implementation and evidence, 2026-10-19

`DALLAPE_AUDIO_CACHE` in `frontend/config.js` defaults to three videos and
192 MiB of reserved encoded audio. Video eviction uses visit order; byte eviction
uses track selection order and protects the selected/attached track. Three times
each track's received bytes are reserved before retaining a chunk, covering
chunks, Blob construction and MediaSource input conservatively. Oversized tracks
fail visibly and release ownership. Invalid limits use defaults. Setting
`enabled: false` disables only budget eviction, allowing independent rollback.
Reload after changing configuration.

Navigation aborts unfinished audio and metadata requests. Changing formats aborts
unfinished unwanted audio. Retirement cancels readers, clears chunks and append
callbacks, detaches MediaSource/SourceBuffer listeners and buffers, unloads the
audio element and revokes retired URLs. Completion releases original chunks;
completed files survive playback errors for download/Blob retry. Hidden links
lose their href, and noncatalog columns from previous videos are removed.
Evicted formats refetch. Tab reload clears the cache; no persistence was added.

Validation:

- All 37 frontend Node checks pass. New assertions cover video LRU and byte
  eviction, refetch, valid selected URLs, released completion chunks, cancellation
  before response/during reads, late EOF, metadata abort, unknown-length budget
  overflow, detached listeners/buffers (including ended MediaSource), playback
  error download retention and rollback behavior. Existing stale callback,
  readiness, stream failure and metadata checks continue passing.
- The optional `node tools/check_audio_browser.mjs` check passes with Playwright
  1.63.0 and headless Chromium 153.0.8010.12, using generated four-second fixtures
  and a fake iframe clock. Opus/WebM MSE and both AAC/MP4 and Opus/WebM Blob
  playback pass. AAC MSE restores original audio after its decode error; retry
  through the completed Blob plays. Invalid audio remains download-only.
- The browser check visits eleven videos with a two-video cap in both Opus
  modes. At each completion it checks at most two retained Blobs (78,376 bytes
  total), at most one MediaSource URL, and readable current download contents.
  Retired URLs reject fetches. A download started before eviction finishes with
  the original bytes. One browser runs at a time.
- CDP memory observation, without forced GC: MSE JS used heap 3,364,032 ->
  3,926,504 bytes, embedder heap 3,828,320 -> 23,236,824 bytes; Blob JS used heap
  3,305,892 -> 3,793,688 bytes, embedder heap 3,839,920 -> 23,125,808 bytes.
  DOM counters also grew between samples (MSE 1,164 -> 8,188 nodes; Blob
  1,422 -> 8,646). These counters include browser allocations and objects
  awaiting collection; bounded ownership does not imply flat process memory or
  particular garbage-collection timing.
- Frontend/browser checks ran through a host memory guard: wait up to ten minutes
  for 2 GiB MemAvailable (then require 1.5 GiB), monitor every 200 ms, terminate
  on less than 1 GiB or swap growth over 512 MiB. Browser start had 2,578,036 KiB
  available; no run was stopped or marked unavailable by the guard.
- No backend behavior changed; backend tests were not rerun. No production
  deployment, live YouTube comparison, human listening assessment or other
  browser coverage is claimed.

The browser script retains only URL sizes in its instrumentation, not Blob or
MediaSource objects. Its ownership assertions are deterministic; memory samples
are observations, without a GC-dependent pass threshold. Reproduction uses the
same optional Playwright/Chromium environment variables documented in HAI-5.
