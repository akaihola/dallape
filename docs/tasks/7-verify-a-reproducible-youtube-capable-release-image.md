# Verify a reproducible YouTube-capable release image

Steward proposal from HAI-3, 2026-10-19. Goal: music; dallape is tier 3. Promotion and implementation remain for the steward to choose.

See [the architecture review](../2026-09-19-architecture-review-and-remediation-plan.md#status-2026-10-19), remediation step 4.

Original step 4, F4 and build aspects of F9. Existing deployment and image-smoke evidence is useful, but manifests and yt-dlp lock are unchanged and no CI exists. Do not build images on hopeli; use a suitable authorized host when this proposal is promoted.

## Acceptance criteria

- Preserve frozen production installs; verify the chosen pinned yt-dlp release has the smallest supported challenge-runtime/EJS setup needed for representative YouTube extraction. Record runtime discovery and sanitized warnings, without assuming a past successful extraction proves challenge support.
- Record Python 3.12 clean build, image digest, dependency/runtime versions, default/custom PORT startup and shutdown/signal behavior; image excludes tests and credentials. Retain matching rollback digest/lockfile.
- Add deterministic CI for frontend/backend suites, tracker check and image startup; keep live provider checks a separately recorded release gate.
- At release, record public format extraction, exact full audio transfer and cold/warm timings from the candidate provider. Reuse existing Scaleway task [1] for deployment records, rather than creating another migration project.
