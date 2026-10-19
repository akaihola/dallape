# Dallapé – sound track audio format comparison and download

[dallape.vempai.men] is a web tool for comparing and downloading video sound
tracks in various formats.

## How to use Dallapé

The user can submit a video URL and preview it embedded on the page. Below the
video preview, common YouTube audio formats are shown as speculative columns.
Clicking on an audio format will switch the sound of the video being played to the selected format so
the user will be able to listen to the difference in real time. Each format has
a button for downloading the corresponding audio file.

Switching to and downloading an audio format has some delay since each audio
track needs to be fetched separately from the video server.

## Internals

### Identifying available audio formats

Initially, a small catalog of common YouTube formats is displayed with estimated
bitrates and unconfirmed availability. The first click on any audio format fetches
the list of available audio formats for that video from the server, and
unavailable formats will be disabled visually. Supported IDs absent from the
initial catalog get their own columns. Backend codec, container, bitrate, language
and variant metadata replace catalog guesses. Missing bitrate or size is labelled
unknown; approximate sizes are labelled estimated. Language is shown only when
reported by the backend. IDs distinguish variants, even when labels match.
Playback MIME and download names use the selected backend metadata. Concurrent
clicks share this request.
If it fails, click a format again to retry. A late response from a previous
video cannot change the current selection.

If the YouTube script or player fails, an error appears beside the Preview
button. Submit the same video again to retry. Submissions made while the player
is starting settle on the latest video once it is ready.

If an audio download or playback fails, the original video's sound resumes and
the format is no longer marked active. Click that format again to fetch and play
it again. Browsers without support for streaming that format keep the original
sound until the complete audio file is available.

### Caching audio formats

Clicking on an audio format which hasn't yet been fetched on the server will
start fetching the corresponding audio track using [yt-dlp]. Download progress
is shown in a circular progress indicator for each format. The progress
indicator also shows the current video playback position.

The fetched audio file is incrementally cached on the frontend. Attachment starts early when MediaSource supports the format. Downloaded byte
fraction never determines playback readiness. The original sound continues until
decoded buffered timestamps cover the requested position with 250 ms of audio at
the selected speed and the replacement's play request succeeds. Near the end of
a complete file, the required buffer ends at the audio duration.

Pausing, seeking outside the buffer or waiting for decoded data restores the
original sound. Playback rate and volume follow the YouTube player every 250 ms.
The player's mute setting at attachment is preserved for both replacement and
restored original sound. The iframe is internally muted during comparison, so
set your desired mute state before selecting a track. Change its volume or pause
at any time. Switching formats restores the original while the next track loads.
Short overlap or gaps remain possible; seamless synchronization has not been
observed or claimed.

Without supported MediaSource, a completed Blob must decode and buffer before
activation. Playback errors clear selection and show retry instructions.
Completed files remain downloadable even if this browser cannot decode them.
Selecting a completed file again retries through Blob playback. Incomplete
failed tracks are discarded and can be fetched again.

Once caching completes, the measured file size replaces the metadata size and
the download button is enabled. A fully fetched audio file is cached on the
frontend while retained, so the backend can discard the data and scale to zero.

Caching is tab-local and fetch-once applies only while a track remains retained.
`frontend/config.js` configures `DALLAPE_AUDIO_CACHE`: by default at most three
videos and 192 MiB of reserved encoded audio. Videos use least recently visited
order; tracks use least recently selected order under byte pressure. The selected
track is protected from eviction. Each track reserves three times its received
bytes, conservatively covering original chunks, Blob construction and MediaSource
input; thus the default admits at most 64 MiB of audio files. Chunks are released
at completion. Browser transport, decoder memory and delayed garbage collection
are outside this ownership budget; it is not a process-memory limit.

Changing video or format aborts incomplete audio transfers; changing video also
aborts its metadata request. An oversized track stops with a budget error and can
be retried after increasing the limit. Eviction revokes retired URLs and removes
download links; selecting an evicted format refetches it. Active playback and
retained download URLs remain valid. Already started downloads are handled by
the browser. Reloading the tab clears the entire cache.

Set `DALLAPE_AUDIO_CACHE.enabled` to `false` to roll back budget enforcement
independently of request ownership, playback readiness and resource cleanup.
This restores unbounded completed-file retention; re-enable and reload to restore
the limits. Positive integer limits are required; invalid values use defaults.

### Video URLs and IDs

Only YouTube is supported. Enter an 11-character YouTube video ID or a supported
YouTube watch, short-link, Shorts, embed or live URL. Other providers and arbitrary
IDs are rejected; there is no provider detection or fallback.

The backend exposes audio-only formats delivered over HTTP or HTTPS. Video-bearing
and manifest formats are excluded. An empty list means no supported formats for
that video. Browser codec limitations are separate: a supported format can still
be fetched and downloaded even when the browser cannot play it. Without streaming
support, playback waits for the completed file and tries Blob decoding.

### The software stack

Dallapé is a frontend first pure JavaScript web application that uses a Python
backend only for the minimal set of operations which are not possible to perform
client-side. Here is a non-exhaustive division of responsibilities between the
frontend and backend as a Markdown table:

| Frontend                                     | Backend                         |
| -------------------------------------------- | ------------------------------- |
| validate video URL/ID entered by the user    |                                 |
| embed video preview with playback controls   |                                 |
| show speculative and available audio formats |                                 |
| query backend for formats for the video      | fetch audio formats for a video |
| cache formats for the video                  |                                 |
| query backend for audio track content        | fetch audio track content       |
| cache audio track content                    |                                 |
| query backend for audio download pregress    | provide audio download progress |

This design lets the backend scale to zero when not in use.

### The API

The API is a RESTful API that provides access to the backend's functionality.
It is also exposed as a public API that can be used by other applications.

## Running and deploying

### Local development

```sh
cd backend
uv run pytest                      # backend unit tests
uv run uvicorn app:app --reload    # serves the API and ../frontend on http://localhost:8000/
node --test frontend/tests/*.test.js  # frontend unit tests (from the repository root)
```

### Production: Scaleway Serverless Container behind Cloudflare

Same model as drum-transcribe's `plokkaus.vempai.men`:

- One container, built from `deploy/Dockerfile` at the repository root,
  serves both `frontend/` and `/api/*` on the same origin, so no CORS or
  `frontend/config.js` change is needed. It keeps no state and scales to
  zero; audio is only streamed through, never stored.
- `dallape.vempai.men` is a **proxied** CNAME in the Cloudflare `vempai.men`
  zone pointing at the container endpoint.
- The Worker in `deploy/cloudflare/` answers page loads that the container
  doesn't answer within 2.5 s with a "Starting up…" page, which polls
  `/api/health` and reloads itself once the app is up.
- A second route, `dallape.vempai.men/api/*`, has no Worker, so API calls
  and audio streams go through Cloudflare's plain proxy straight to
  Scaleway and don't count against the Worker's free-plan quota.
- The [scanner WAF rule](docs/tasks/1-scaleway-deployment.md#block-scanner-probes-with-cloudflare-waf)
  defines hostname-scoped blocking for `/.env*` and `/.git/*`; deployment
  and verification steps are documented there.

Build and deploy (the container needs a request timeout of 900 s for long
audio streams):

```sh
podman build -f deploy/Dockerfile -t rg.fr-par.scw.cloud/dallape/app:latest .
podman push rg.fr-par.scw.cloud/dallape/app:latest
, scw container container redeploy 3e5fe326-ad5a-4389-b8b8-e7fc9fccc7a1 --profile drum-transcribe
cd deploy/cloudflare && npx wrangler@4 deploy   # only after editing the Worker
```

On atom, `podman` is logged in to the registry, and `wrangler` needs the
Cloudflare token from drum-transcribe's `.secrets.cloudflare.env`
(`set -a && . …/.secrets.cloudflare.env && set +a`). Resource IDs, the
one-time setup and measured timings are in
[docs/tasks/1-scaleway-deployment.md][deployment task].
**Off switch for the Worker:** set the `dallape` DNS record back to "DNS
only".

Optional environment variables: `ALLOWED_ORIGINS` (comma-separated CORS
origins for third-party API users, default `*`) and `YTDLP_COOKIEFILE`
(path to a Netscape cookie file, for videos YouTube refuses to serve to
anonymous datacenter clients). Never bake cookie files or other credentials
into the image.

yt-dlp breaks whenever YouTube changes; run `uv lock --upgrade-package yt-dlp`
in `backend/` and redeploy to pick up fixes.

The same image runs on any container host (Cloud Run, Fly.io, a VPS) that
sets `PORT` or maps port 8080.

[dallape.vempai.men]: https://dallape.vempai.men
[yt-dlp]: https://github.com/yt-dlp/yt-dlp
[deployment task]: docs/tasks/1-scaleway-deployment.md

### Audio API contract

`GET /api/formats?url=…` accepts a YouTube URL or an 11-character video ID.
`GET /api/audio?url=…&format=…` accepts the same input plus an audio-only
`format_id` returned by the formats endpoint. Both parameters remain query
parameters. Invalid input returns 400, missing parameters return 422, an
unavailable audio format returns 404, and extraction or initial upstream audio
failure returns 502 with a generic error detail. Credentials, malformed ports
and unsupported URL authorities are rejected.

The audio endpoint returns 200 with an attachment filename and audio media type.
An exact yt-dlp filesize, when available, supplies Content-Length; approximate
sizes are not used as byte counts. Upstream status, Content-Range, Content-Length
and actual response lengths are checked. A server ignoring a requested range is
rejected. There are no automatic stream retries. A failed format can be fetched
again by clicking it, starting a new request from the beginning.

The backend reads ahead before sending success headers. Failures detected after
headers terminate the HTTP response without completing its framing. Clients must
discard partial files, including streams with unknown length; an HTTP 200 alone
is not proof of completion. The browser enables downloading only after clean EOF
and a match with any known Content-Length. The backend holds the final block of
each upstream response until its length is verified, closes upstream handles on
failure or disconnect, and suppresses upstream exception details in errors and
tracebacks. Socket inactivity timeout is 10 seconds; the 840-second stream budget
is checked before and after each blocking read. Cleanup waits for an active read
to return or time out. This is not a hard wall-clock deadline for a peer that
continually trickles bytes within one read.

Client Range requests are not forwarded. The endpoint promises neither partial
responses nor client resume support. Unknown-size streams use one upstream
request and rely on clean upstream EOF and HTTP framing, rather than an
independently known total size.

The formats response retains `format_id`, `ext`, `acodec`, `abr`, `filesize`,
`filesize_approx` and `mime`. Additive nullable fields `language`, `format_note`
and `audio_channels` preserve extractor variant metadata. `filename` is the
unencoded download name derived from that format and title; the audio response
percent-encodes the same name in Content-Disposition. Missing bitrate uses
"Unknown bitrate". Language/variant names include the format ID to distinguish
tracks. Approximate size never becomes an HTTP Content-Length.
