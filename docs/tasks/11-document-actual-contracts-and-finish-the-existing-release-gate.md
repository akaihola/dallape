---
depends-on: [4, 5, 6, 7, 8, 9, 10]
---

# Document actual contracts and finish the existing release gate

Steward proposal from HAI-3, 2026-10-19. Goal: music; dallape is tier 3. Promotion and implementation remain for the steward to choose.

See [the architecture review](../2026-09-19-architecture-review-and-remediation-plan.md#status-2026-10-19), remediation step 8.

Original step 8, F9 and remaining F4/F5 validation. Continue deployment evidence in existing task [1]; do not repeat completed deployment or rewrite dated records as new passes.

## Acceptance criteria

- Separate root frontend-test commands, backend tests and the server terminal in README; record tested Node version and run commands from their stated directories.
- Document API parameters/fields/errors, protocol subset, partial streams, retry/playback fallback/cache behavior, operating limits, cookie policy, ephemeral yt-dlp state and rollback near existing sections.
- Record complete backend/frontend regression results and local tracker check, plus image checks on a suitable host. Preserve historical failed/blocked attempts and distinguish historical evidence from new results.
- In task [1], finish a real scale-to-zero cold start/loading-page check, and record remaining progressive playback, cross-origin and bounded-concurrency gates with image digest and cold/warm timings. Reuse existing exact full-transfer evidence where still applicable; state cookie mode if used.
- Same-origin serving supersedes a mandatory frontend/config.js endpoint switch; retain the fallback configuration/image before future switches. Keep the scanner WAF deployment in its existing issue, without duplicating it.
