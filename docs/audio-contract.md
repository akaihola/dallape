# Audio behavior and API

## Supported inputs and formats

Only YouTube is supported. Enter an 11-character video ID or a YouTube watch,
short-link, Shorts, embed, live or legacy `/v/` URL. Both the browser and backend
validate input independently. Other providers, invalid IDs, credentials in URLs,
malformed ports and unsupported authorities are rejected.

The initial columns use the nominal estimates in [frontend/providers.js]. The
first format click requests metadata; concurrent clicks share that lookup and
failed lookups can be retried. Supported IDs absent from the catalog get their
own columns, while unavailable catalog formats are disabled. Backend codec,
container, bitrate, language and variant metadata replace guesses. Missing
bitrate or size is labelled unknown; approximate sizes are labelled estimated.
IDs distinguish variants even when labels match. Playback MIME and download
names use the selected backend metadata.

The backend exposes audio-only formats delivered over HTTP or HTTPS, excluding
video-bearing and manifest formats. An empty list means no supported formats for
that video. A format may still be downloadable when the browser cannot play it.

## Playback and retry

The original sound continues while the replacement attaches and decodes.
Activation requires decoded buffered timestamps covering the requested position
plus 250 ms at the selected playback speed, and a successful play request. Near
the end of a complete file, the required buffer ends at the audio duration.
Received byte counts measure download progress, never playback readiness.

MediaSource starts decoding during transfer when the browser supports the MIME
type. Otherwise, playback waits for the completed Blob to decode and buffer.
Pausing, seeking outside the buffer or waiting for decoded data restores the
original sound. Playback rate and volume follow the YouTube player every 250 ms.
While the page is hidden, a playing replacement keeps its own position instead
of seeking to the player's. Firefox throttles the muted player in a background
tab, and its reported time lags. Pausing still stops the replacement; the next
start and a visible page follow the player's position again.
The player's mute setting at attachment is preserved for both replacement and
restored original sound. Set the desired mute state before selecting a track:
the iframe is internally muted during comparison. Volume and pause controls
remain usable. Switching formats restores the original while the next loads.
Short overlap or gaps remain possible; seamless synchronization is not promised.

Failures have different retry paths:

- **Player:** script or player failure shows an error beside Preview. Submit the
  same video again to retry. Submissions during initialization settle on the
  latest video once the player is ready.
- **Metadata:** click a format again after a failed lookup. A late response for
  a previous video cannot change the current selection.
- **Transfer:** failed, truncated or oversized transfers are discarded. Original
  sound resumes, active selection clears, and another click fetches from the
  beginning. A cache-budget error requires more room; see [cache settings].
- **Playback:** original sound resumes and selection clears, but the transfer
  continues within the cache budget. Clicking again waits for the completed
  Blob and retries playback without another transfer. Cleanly completed files
  remain downloadable even if decoding fails. Changing video or selecting a
  different format still cancels an incomplete transfer.

## Cache settings

[frontend/config.js] sets `DALLAPE_AUDIO_CACHE`. Defaults are `enabled: true`,
`maxVideos: 3` and `maxBytes: 192 * 1048576` (192 MiB). The latter two values must
be positive safe integers; invalid limits fall back to these defaults. Settings
are read when [frontend/app.js] starts: reload the tab after changing them.

The cache is tab-local. Videos use least recently visited order; tracks use
least recently selected order under byte pressure. The selected or attached
track is protected from eviction. Each track reserves three times its received
bytes for original chunks, Blob construction and MediaSource input, so the
default admits at most 64 MiB of encoded audio. Chunks are released at completion,
but the reservation remains until eviction. Browser transport, decoder memory
and delayed garbage collection are outside this accounting budget.

Changing video aborts its metadata request and incomplete audio transfers;
changing format aborts other incomplete tracks. Eviction revokes retired URLs
and removes download links. Retained playback/download URLs remain valid;
already started downloads are handled by the browser. Selecting an evicted
format refetches it. Reloading clears the cache.

Set `enabled: false` and reload to disable budget enforcement. Request ownership
and resource cleanup still apply, but completed-file retention becomes unbounded.
Re-enable and reload to restore limits. A track exceeding the byte budget stops
with an error; increasing the limit also requires a reload before retrying.

## Backend responsibilities

[backend/app.py] validates inputs, extracts format metadata with yt-dlp and
proxies selected audio bytes. Each audio request re-extracts metadata; there is
no server-side audio-file cache. [frontend/app.js] caches metadata and audio,
tracks received bytes and manages playback. There is no progress endpoint.

The application stores no media files or durable application data. yt-dlp may
write its filesystem cache and a configured cookie file; see [backend settings].

## HTTP contract

The default same-origin API also provides [interactive API documentation] and
an [OpenAPI schema]. [backend/app.py] defines these endpoints:

- **Health:** `GET /api/health` returns `{"ok": true}` without extraction.
- **Formats:** `GET /api/formats?url=…` accepts a supported YouTube URL or video
  ID and returns `id`, `title`, `duration` (seconds) and `formats`.
- **Audio:** `GET /api/audio?url=…&format=…` accepts the same input plus an
  audio-only `format_id` returned by the formats endpoint. Both inputs remain
  query parameters. Success returns audio bytes with an attachment filename
  and container media type; the formats response's `mime` also includes codec
  information for browser playback.

Invalid video input returns 400, missing required parameters return 422, an
unavailable audio format returns 404, and yt-dlp `DownloadError` during extraction
or an initial `AudioStreamError` returns 502 with generic detail. Other unexpected
exceptions are not mapped by these handlers.

Each format retains `format_id`, `ext`, `acodec`, `abr` (kbps), `filesize`,
`filesize_approx` (bytes) and `mime`. Nullable `language`, `format_note` and
`audio_channels` preserve variant metadata. `filename` is the unencoded download
name derived from the format and title; Content-Disposition uses the same naming
rule with percent-encoding. Missing bitrate uses "Unknown bitrate". Names include
the format ID when language or variant notes are present.

An exact yt-dlp filesize, when available, supplies Content-Length; approximate
sizes are never byte-count guarantees. Upstream status, Content-Range,
Content-Length and actual response lengths are checked. A server ignoring a
requested range is rejected. There are no automatic stream retries. Client Range
requests are not forwarded: the endpoint promises neither partial responses nor
client resume support.

The backend reads ahead before sending success headers and holds each upstream
response's final block until its length is verified. Failures detected after
headers terminate the response without completing HTTP framing. Clients must
discard partial files, including streams of unknown length; HTTP 200 alone is
not proof of completion. The browser enables downloading only after clean EOF
and a match with any known Content-Length. Unknown-size streams use one upstream
request and rely on clean EOF and HTTP framing rather than an independently
known total size.

Upstream stream handles close on failure or disconnect; networking exception
details are suppressed in the stream error and chained traceback. Socket
inactivity timeout is 10 seconds. A separate 840-second stream budget is checked
before upstream requests and before/after each blocking read; it begins after
metadata extraction. Cleanup waits for an active read to return or time out.
This is not a hard wall-clock deadline for a peer trickling bytes within one
read, and does not bound extraction or total concurrent service work.

[frontend/providers.js]: ../frontend/providers.js
[frontend/config.js]: ../frontend/config.js
[frontend/app.js]: ../frontend/app.js
[backend/app.py]: ../backend/app.py
[cache settings]: #cache-settings
[backend settings]: development.md#configuration
[interactive API documentation]: http://localhost:8000/docs
[OpenAPI schema]: http://localhost:8000/openapi.json
