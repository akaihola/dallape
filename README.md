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

This design allows hosting the static frontend on a CDN and scaling the backend
to zero when not in use.

### The API

The API is a RESTful API that provides access to the backend's functionality.
It is also exposed as a public API that can be used by other applications.

## Running and deploying

### Local development

```sh
cd backend
uv run pytest                      # backend unit tests
uv run uvicorn app:app --reload    # serves the API and ../frontend on http://localhost:8000/
node --test frontend/tests/        # frontend unit tests (from the repository root)
```

### Backend on Google Cloud Run

The backend keeps no state between requests, so it can scale to zero. Deploy
it straight from `backend/` (the Dockerfile is used because one is present):

```sh
gcloud run deploy dallape-api --source backend --region <region> \
  --min-instances 0 --timeout 900 --allow-unauthenticated \
  --set-env-vars ALLOWED_ORIGINS=https://dallape.vempai.men
```

Optional environment variables: `ALLOWED_ORIGINS` (comma-separated CORS
origins, default `*`) and `YTDLP_COOKIEFILE` (path to a Netscape cookie file
mounted into the container, for videos YouTube refuses to serve to anonymous
datacenter clients).

yt-dlp breaks whenever YouTube changes; run `uv lock --upgrade-package yt-dlp`
in `backend/` and redeploy to pick up fixes.

### Backend on Fly.io or a VPS

Build the image from `backend/` and publish it to a registry, then expose the
container's port 8080. Fly.io sets `PORT` to the service port; the image uses
that value and falls back to 8080. A VPS can run the same image with
`-p 8080:8080` (or map another host port):

```sh
cd backend
docker build -t dallape-backend .
docker run --rm -p 8080:8080 \
  -e ALLOWED_ORIGINS=https://dallape.vempai.men \
  dallape-backend
```

Set `ALLOWED_ORIGINS` and, when needed, `YTDLP_COOKIEFILE` through the
provider's secret or environment configuration. Do not bake cookie files or
other credentials into the image. The backend is stateless; persistent
volumes are unnecessary.

### Frontend on a CDN

`frontend/` is plain static files with no build step. Set the Cloud Run
service URL in `frontend/config.js` and upload the directory to any static
host (a Cloud Storage bucket behind Cloud CDN, Cloudflare Pages, Firebase
Hosting, …). The frontend contacts the backend only to list the formats of a
video (once, on the first format click) and to fetch each audio track (once).
Download progress is derived from the streamed bytes, so no polling is needed.

[dallape.vempai.men]: https://dallape.vempai.men
[yt-dlp]: https://github.com/yt-dlp/yt-dlp
