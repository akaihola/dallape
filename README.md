# Dallapé – sound track audio format comparison and download

[dallape.vempai.men] is a web tool for comparing and downloading video sound
tracks in various formats.

## How to use Dallapé

The user can submit a video URL and preview it embedded on the page. Below the
video preview, all audio formats are listed in columns. Clicking on an audio
format will switch the sound of the video being played to the selected format so
the user will be able to listen to the difference in real time. Each format has
a button for downloading the corresponding audio file.

Switching to and downloading an audio format has some delay since each audio
track needs to be fetched separately from the video server.

## Internals

### Identifying available audio formats

Initially, all audio formats supported by the video provider are displayed in
the audio format columns. The first click on any audio format will first fetch
the list of available audio formats for that video from the server, and
unavailable formats will be disabled visually.

### Caching audio formats

Clicking on an audio format which hasn't yet been fetched on the server will
start fetching the corresponding audio track using [yt-dlp]. Download progress
is shown in a circular progress indicator for each format. The progress
indicator also shows the current video playback position.

The fetched audio file is incrementally cached on the frontend. Once fetching
has progressed beyond the playback position, the sound playback of the preview
video is switched to that of the cached audio, and a visual indicator is updated
to show which format is currently playing.

Once caching has completed, also the file size is displayed and the download
button enabled. A fully fetched audio file is also fully cached on the frontend
so the backend can discard the data and scale to zero.

### Video URLs and IDs

The video to preview is identified by its URL or ID. All the known different URL
variants for a video provider are recognized. For video IDs, the provider is
automatically detected based on the format of the ID. If the ID format is not
recognized, the most popular provider is assumed.

### The software stack

Dallapé is a frontend first pure JavaScript web application that uses a Python
backend only for the minimal set of operations which are not possible to perform
client-side. Here is a non-exhaustive division of responsibilities between the
frontend and backend as a Markdown table:

| Frontend                                     | Backend                         |
| -------------------------------------------- | ------------------------------- |
| validate video URL/ID entered by the user    |                                 |
| embed video preview with playback controls   |                                 |
| show all audio formats the provider supports |                                 |
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

Build and deploy (the container needs a request timeout of 900 s for long
audio streams):

```sh
podman build -f deploy/Dockerfile -t rg.fr-par.scw.cloud/dallape/app:latest .
podman push rg.fr-par.scw.cloud/dallape/app:latest
, scw container container redeploy <container-id>
cd deploy/cloudflare && npx wrangler@4 deploy   # only after editing the Worker
```

One-time setup and the checks that remain are in
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
