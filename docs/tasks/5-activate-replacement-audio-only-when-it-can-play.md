---
depends-on: [4]
---

# Activate replacement audio only when it can play

Steward proposal from HAI-3, 2026-10-19. Goal: music; dallape is tier 3. Promotion and implementation remain for the steward to choose.

See [the architecture review](../2026-09-19-architecture-review-and-remediation-plan.md#status-2026-10-19), remediation step 2.

Original step 2, F1. Byte progress currently activates and mutes before playable audio exists. Preserve audible comparison through transfer and decoding failures.

## Acceptance criteria

- Keep original sound until replacement audio is attached, decoded and buffered at the requested time; use buffered ranges rather than byte fraction for readiness.
- Without supported MSE, switch only after completed Blob playback is ready. Delayed sourceopen and obsolete callbacks cannot attach retired tracks.
- Recover visibly from SourceBuffer creation/append/media errors, play rejection and transfer failure; define mute/volume behavior and synchronize playback rate.
- Deterministic checks cover missing Content-Length, pause/resume, forward/back seeks beyond buffer, non-1x speed, and switching during/after transfer.
- Real AAC/Opus fixture checks record tested browser/format combinations and download-only fallback. Include an explicit input label and accessible selected/loading state; verify keyboard operation and screen-reader state. Do not claim seamless playback without observation.
