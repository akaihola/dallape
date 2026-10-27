---
depends-on: [6, 7]
---

# Bound public audio work and decide safe cookie policy

Steward proposal from HAI-3, 2026-10-19. Goal: music; dallape is tier 3. Promotion and implementation remain for the steward to choose.

See [the architecture review](../2026-09-19-architecture-review-and-remediation-plan.md#status-2026-10-19), remediation step 5.

Original step 5, F5/F6. Recorded max-scale=2, autoscaling threshold=20 and timeout=900s are partial progress, not an application admission/deadline/size contract. Anonymous extraction worked in the historical deployment; do not introduce an account system.

## Acceptance criteria

- Define measured application admission, total-operation deadline, media size/duration and unknown-size policies, with retryable overload rejection before extraction and disconnect cleanup.
- Document provider instance/concurrency limits separately from application limits; check slow/blocked upstream and bounded resource use. Verify documented CORS behavior without presenting CORS as authentication.
- Explicitly decide whether the public service may use account authority. Prefer anonymous operation if account-authorized content is outside scope; either remove/disable unsupported cookie mode or implement isolated per-operation jars from immutable input.
- If retained, read-only synthetic cookie input stays unchanged, concurrent requests cannot overwrite jars, temporary files have private permissions and disappear on success/failure. No real credentials in tests.
- Public responses and operational logs exclude secret values and sensitive upstream URLs/account context; preserve useful sanitized diagnostics. Record rollback and independent cookie-disable procedure.
