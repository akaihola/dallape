# YouTube metadata fixture

[frontend/tests/fixtures/youtube-multilingual.json][capture] is a six-format
subset of a live yt-dlp capture of YouTube video `TJ2ifmkGGus` on 2026-10-19,
using the repository-locked yt-dlp.
It retains exact extractor values for IDs, codecs, containers, bitrates, sizes,
language, notes, channels, video codec and protocol. Signed URLs, HTTP headers,
thumbnails and unrelated metadata were removed. `mime` and `filename` are the
backend projection of these captured rows, produced by `audio_formats` and
`download_filename` in [backend/app.py]. No audio is included.

The sample covers Italian, German, English original/default, low/medium quality,
AAC and Opus, including IDs with variant suffixes. Tests separately mutate rows
for missing fields, changed bitrate, unsupported protocols and hostile text;
those mutations are synthetic edge cases, not claimed as captured values.

[capture]: youtube-multilingual.json
[backend/app.py]: ../../../backend/app.py
