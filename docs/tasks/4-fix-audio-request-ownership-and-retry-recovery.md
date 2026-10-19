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

## Implementation evidence, 2026-10-19

- Metadata requests share an in-flight promise that is cleared on settlement.
  Selection resumes only for the current submission and latest format click.
- Player creation is shared until readiness. The latest submission loads after
  readiness; script errors, readiness timeouts and player errors show retry
  instructions. A new submission can recreate a failed player.
- Each audio attachment owns its MediaSource, buffer, error and play-promise
  callbacks. Retired callbacks are ignored. Failed active streams or playback
  restore original sound, clear activation and discard the track for retry.
  Late failures from discarded streams cannot delete replacement requests.
- The existing application stays in one module. `startApp` injects browser
  dependencies for deferred-promise and player/media fakes without a framework.
- README documents retries. Unsupported streaming formats wait for the complete
  Blob; decoded readiness and buffering policy remain HAI-5's scope.

Validation: `node --test frontend/tests/*.test.js` passes all 17 checks on
Node v24.21.0, including 14 lifecycle regression checks. `uv run pytest` from
`backend/` passes all 23 checks, with one dependency deprecation warning.
`git diff --check` passes. Live browser playback and production deployment were
not exercised in this task.
