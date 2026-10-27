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

## Implementation and evidence, 2026-10-19

The initial ten columns remain speculative, with estimated bitrates and
unconfirmed availability. A per-video map retains backend metadata, renders new
IDs and replaces known-ID guesses. Selection resolves the authoritative entry
before fetching; labels, MediaSource codec string, Blob type and download name
use that entry. Missing bitrate/container/codec/size is labelled unknown.
Approximate sizes are labelled estimated; completed transfers show measured size.
Unavailable formats are disabled separately from browser playback limitations.
Supported files can be fetched and downloaded even when decoding fails.

The API keeps existing keys and adds nullable language, format_note and
audio_channels plus a filename derived from selected metadata. Variant filenames
include the format ID. Missing bitrate no longer breaks filename generation.
Unknown containers use application/octet-stream rather than a guessed MP4 type.
The audio-only HTTP/HTTPS filter is unchanged. No provider abstraction was added;
README now describes YouTube-only input and speculative initial columns.

A live yt-dlp capture of TJ2ifmkGGus returned 120 audio-only HTTP/HTTPS formats
across 24 languages. The committed six-row fixture preserves original IDs,
bitrate, codec, container, language, notes and channels for Italian, German and
English original/default AAC/Opus variants. Signed URLs and request headers were
removed. Fixture provenance is documented beside it. Synthetic cases separately
cover missing fields, a known ID with changed codec/container/bitrate, estimates,
empty results and hostile display text. Language is never inferred from IDs.

Validation:

- Node frontend suite: 31 tests pass, including exact variant requests, backend
  filename retention, MSE/Blob MIME, no supported formats, missing bitrate/size,
  unknown-ID columns, navigation reset and download-only behavior.
- Python backend suite: 70 tests pass. Captured projection and audio responses
  agree on filename/MIME; unknown IDs still reject video, manifest and non-HTTP
  formats. One existing Starlette/AnyIO deprecation warning remains.
- Chromium 154.0.8037.92 with generated real audio: Opus/WebM MSE and AAC/Opus
  completed Blob playback pass. AAC MSE decoding fails as previously recorded,
  restores original audio, retains the download and plays on completed Blob retry.
  Invalid audio stays download-only in both modes. Keyboard and accessibility
  selected/loading/playing state checks pass. The repository browser script now
  supplies full metadata rather than ID-only responses.
- Tracker invariant and git diff whitespace checks pass.

T3 preview could not launch due to missing host libraries; the repository's
Playwright check used installed Nix Chromium. Browser checks use a fake iframe
clock and generated audio, with autoplay allowed. Live metadata extraction was
verified; live audible comparison, other browsers and production deployment were
not performed. Deploy the additive backend metadata before or with the frontend.
