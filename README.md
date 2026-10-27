# Dallapé – audio format comparison and download

[dallape.vempai.men] compares and downloads YouTube audio tracks in the browser.
Enter a supported YouTube URL or an 11-character video ID and select **Preview**.
Click an audio format to fetch it; the first click also checks which formats are
available for that video. The original sound continues until the selected track
can play. A completed file gets a **Download** link, even if the browser cannot
decode it. The ring shows download progress and the dot shows playback position.

Audio is cached in the current tab within configurable video and byte limits.
Reloading clears it. See [audio behavior and API] for supported inputs, metadata,
playback recovery, cache settings and the HTTP contract.

## Development and deployment

The [development guide] covers local startup, tests, configuration and the
recorded Scaleway/Cloudflare deployment. The application uses static JavaScript
and a Python backend; both are served from one origin by default.

Current work and acceptance state live in [TASKS.md]. The [architecture recheck]
and [documentation review] distinguish implemented behavior from remaining
release and operating-policy work. Dated reviews describe their own snapshots.

[dallape.vempai.men]: https://dallape.vempai.men
[audio behavior and API]: docs/audio-contract.md
[development guide]: docs/development.md
[TASKS.md]: TASKS.md
[architecture recheck]: docs/reviews/2026-10-21-architecture-recheck.md
[documentation review]: docs/reviews/2026-10-22-docs-review.md
