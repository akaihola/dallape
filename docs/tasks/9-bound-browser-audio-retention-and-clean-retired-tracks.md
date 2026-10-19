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
