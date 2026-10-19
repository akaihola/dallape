---
depends-on: [5]
---

# Use backend format metadata for playback and downloads

Steward proposal from HAI-3, 2026-10-19. Goal: music; dallape is tier 3. Promotion and implementation remain for the steward to choose.

See [the architecture review](../2026-09-19-architecture-review-and-remediation-plan.md#status-2026-10-19), remediation step 7.

Original step 7, F8. The client still saves only IDs and uses its ten-row static catalog. Keep initial speculative columns, then merge authoritative backend metadata.

## Acceptance criteria

- Render supported unknown IDs and use selected metadata consistently for codec/container/bitrate labels, playback MIME and download filename.
- Cover changed bitrate for a known ID, absent bitrate/size, no supported formats and captured language/variant fixtures; label estimates/unknowns and avoid guessing language.
- Distinguish unavailable formats from browser playback limitations; preserve backend audio-only HTTP/HTTPS allowlist and compatible response keys.
- Correct README's all-formats/provider-fallback claims and document YouTube-only support; retain small fixture-driven implementation without a provider abstraction.
