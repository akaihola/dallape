# Development and deployment

## Local development

Use uv and Python 3.12 or newer, as declared in [backend/pyproject.toml]. The
2026-10-22 documentation check ran the locked dependencies with Python 3.14.7
and Node v24.21.0. No frontend dependency install is needed for the unit tests.

From the repository root, run the backend tests in a subshell:

```sh
(cd backend && uv run --frozen pytest)
```

Run the frontend tests and required tracker check from the repository root:

```sh
node --test frontend/tests/*.test.js
python3 tools/check_tasks_md.py TASKS.md
```

Start the development server in its own terminal, from the repository root:

```sh
cd backend
uv run --frozen uvicorn app:app --reload
```

Open [the local application]. The backend serves [frontend/] and the API from
one origin. [Audio behavior and API] describes the endpoint and playback contract.
The tracker checker detects matching normalized bullet text across headings; it
does not validate issue identity, dependencies or every rule in [TASKS.md].

The optional [tools/check_audio_browser.mjs] exercises locally generated
AAC/Opus and invalid media with a fake YouTube player. It requires external
Playwright, Chromium and ffmpeg, and runs from the repository root:

```sh
node tools/check_audio_browser.mjs
```

`PLAYWRIGHT_MODULE` can select the installed Playwright module, and
`CHROMIUM_EXECUTABLE_PATH` can select the browser executable. The script checks
real decoding, fallback, keyboard state and retention; it does not establish
live YouTube playback or progressive network delivery. Its audio routes release
complete response bodies. Historical results are in the [architecture recheck].

## Configuration

[frontend/config.js] sets `DALLAPE_API_BASE` to an empty string for same-origin
requests. Its audio retention settings are documented once under [cache settings].
Reload the page after changing frontend configuration.

[backend/app.py] reads these optional environment variables:

- **ALLOWED_ORIGINS:** comma-separated CORS origins, default `*`. Values are
  split literally, so omit surrounding spaces. CORS is browser access policy;
  it does not authenticate callers or limit extraction/transfer work.
- **YTDLP_COOKIEFILE:** unset by default; a Netscape cookie-file path passed
  directly to every extraction and stream operation. The locked yt-dlp can save
  this file on close, so a read-only mount is not supported safely and concurrent
  operations can share writes. Public callers also share the account's access.
  The [public-service and cookie-policy task] owns the unresolved policy and
  isolation work. Never bake cookies or credentials into an image.

The application keeps no media files or durable data. `ydl_opts` leaves yt-dlp's
filesystem cache enabled, and cookie mode can write the configured file. There
is no application admission cap or media size/duration policy. The [stream
contract] describes the existing timeouts and their limits.

## Recorded Scaleway deployment

[deploy/Dockerfile] builds one image from the repository root and serves
[frontend/] and `/api/*` together. It installs frozen production dependencies
and defaults `PORT` to 8080; the entry command reads `PORT`. A local uvicorn
invocation uses its own CLI port option instead.

The [deployment record] describes the proxied Cloudflare CNAME, Scaleway
container, resource IDs and measured timings. [deploy/cloudflare/worker.js]
returns a 503 "Starting up…" page for navigation requests after 2.5 seconds,
upstream fetch failure or upstream status 502 and above. The page polls health
every two seconds and reloads once healthy. Non-navigation requests pass through.
The API's separate no-Worker route is configured outside
[deploy/cloudflare/wrangler.toml]; that exclusion is not enforced by the handler.
The [scanner WAF rule] is documented separately and still awaits deployment
in [TASKS.md]. These are repository records, not a fresh live-configuration check.

From the repository root on a configured deployment host:

```sh
podman build -f deploy/Dockerfile -t rg.fr-par.scw.cloud/dallape/app:latest .
podman push rg.fr-par.scw.cloud/dallape/app:latest
, scw container container redeploy 3e5fe326-ad5a-4389-b8b8-e7fc9fccc7a1 --profile drum-transcribe
```

The recorded container request timeout is 900 seconds. Registry authentication
and the `drum-transcribe` Scaleway profile are prerequisites. On NixOS, the comma
command above supplies `scw` when it is not installed. Only after Worker edits,
deploy it from the repository root. Use the token described in the [deployment
record], then run:

```sh
(cd deploy/cloudflare && npx wrangler@4 deploy)
```

Changing the DNS record to "DNS only" bypasses both the Worker and Cloudflare's
proxy/WAF. Preserve the recorded fallback and release evidence before switching
services. The [release-image task], [public-service and cookie-policy task] and
[release-gate task] remain open; successful unit tests do not close those gates.

To update yt-dlp, run `uv lock --upgrade-package yt-dlp` from [backend/], then
validate the candidate image and provider behavior before redeploying. The
current image uses a mutable base tag and the locked bare yt-dlp package;
challenge-runtime reproducibility is part of the [release-image task].

[backend/pyproject.toml]: ../backend/pyproject.toml
[the local application]: http://localhost:8000/
[frontend/]: ../frontend/
[backend/]: ../backend/
[Audio behavior and API]: audio-contract.md
[TASKS.md]: ../TASKS.md
[tools/check_audio_browser.mjs]: ../tools/check_audio_browser.mjs
[architecture recheck]: reviews/2026-10-21-architecture-recheck.md
[frontend/config.js]: ../frontend/config.js
[backend/app.py]: ../backend/app.py
[cache settings]: audio-contract.md#cache-settings
[stream contract]: audio-contract.md#http-contract
[deploy/Dockerfile]: ../deploy/Dockerfile
[deployment record]: tasks/1-scaleway-deployment.md
[deploy/cloudflare/worker.js]: ../deploy/cloudflare/worker.js
[deploy/cloudflare/wrangler.toml]: ../deploy/cloudflare/wrangler.toml
[scanner WAF rule]: tasks/1-scaleway-deployment.md#block-scanner-probes-with-cloudflare-waf
[release-image task]: tasks/7-verify-a-reproducible-youtube-capable-release-image.md
[public-service and cookie-policy task]: tasks/8-bound-public-audio-work-and-decide-safe-cookie-policy.md
[release-gate task]: tasks/11-document-actual-contracts-and-finish-the-existing-release-gate.md
