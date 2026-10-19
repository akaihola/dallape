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

## Implementation and evidence, 2026-10-19

Attachment and activation are separate. Supported MSE attaches during transfer,
including transfers without Content-Length. Activation requires readyState >= 3,
a buffered range containing the requested timestamp and a 250 ms runway scaled
by playback rate, plus successful playback. Completed-file readiness caps the
runway at audio duration. Byte fraction is only a transfer indicator.

Seeks, waiting and pause restore original sound. Play promises, sourceopen,
SourceBuffer and media callbacks are guarded by attachment ownership. Transfer,
append, buffer creation, decoding and play failures display retry instructions.
Completed files survive playback failure for download or Blob retry. Unsupported
MSE waits for clean EOF, then decoded Blob readiness.

Volume and rate follow the iframe. The mute state sampled at attachment is
preserved; the iframe's mute control is reserved internally while comparison is
active. Set mute before selection. Playback starts before muting the original,
so a short overlap is possible. There is no seamless playback claim.

The input has an explicit label. Native format buttons expose aria-pressed for
selection, aria-busy and a loading name until activation, and a playing name once
active. Errors use a status output. Selected and loading states are inspected
through browser accessibility snapshots/ARIA attributes; no human screen-reader
listening session was performed.

Validation:

- Node v24.21.0: all 27 frontend checks pass, including deferred decoding/play,
  missing length, unsupported MSE, retired sourceopen/callbacks, pause/resume,
  seeks forward/backward outside buffer, 2x speed, volume/mute, switching during
  transfer and after completion, append/media/play/transfer failures.
- Python 3.14.7: all 62 backend checks pass. One existing Starlette/AnyIO
  deprecation warning.
- Tracker invariant and git diff whitespace checks pass.
- Real generated 4-second sine fixtures, ffmpeg 9.0.1, Playwright 1.63.0,
  headless Chromium 154.0.8037.92 on NixOS: Opus/WebM MSE playback passes;
  AAC-LC fragmented MP4 MSE reports a decode error, restores original and
  retains download, then a keyboard retry plays the completed Blob.
  Forced no-MSE Blob playback passes for both AAC-LC/MP4 and Opus/WebM.
  Invalid audio in both modes restores original and remains download-only.
  Successful cases verify decoded readiness, buffered ranges, 1.5x rate,
  volume 0.4, keyboard Space/Enter and selected/loading/playing state.
- The T3 preview could not launch because host browser libraries were missing.
  The integration check used a separately installed Nix Chromium.
- These are local real-media checks with a fake iframe clock and autoplay
  explicitly allowed. No live YouTube comparison, audible human assessment,
  Firefox/Safari/mobile check or production deployment is claimed.

Reproduce the optional browser check from the repository root with ffmpeg and
Playwright installed, supplying an executable if the default browser is absent:

```bash
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium \
node tools/check_audio_browser.mjs
```

The script generates fixtures in a temporary directory and deletes them. It
serves only local app files, substitutes API responses and the YouTube player,
and makes no real provider requests. AAC MSE failure is allowed and reported;
Opus MSE and both Blob decodes are required, as is download-only error recovery.
