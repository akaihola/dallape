# Fix audio request ownership and retry recovery

Steward proposal from HAI-3, 2026-10-19. Goal: music; dallape is tier 3. Promotion and implementation remain for the steward to choose.

See [the architecture review](../2026-09-19-architecture-review-and-remediation-plan.md#status-2026-10-19), remediation step 1.

Original step 1, F2 and retry portion of F1. The frontend is unchanged since the review. Fix the request/player lifecycle in place, with a small deterministic test seam.

## Acceptance criteria

- Failed format metadata requests can be retried; concurrent successful clicks share one request.
- After every asynchronous boundary, old-video responses, errors and callbacks cannot change the current player or selection.
- Rapid first-player submissions settle on the latest video after readiness; iframe script/player errors have visible recovery.
- Failed active audio restores original sound, clears activation and allows same-format retry.
- Deferred-promise/player-fake regression checks prove these cases; README explains retry behavior. No new framework or lifecycle abstraction without a demonstrated need.
