---
title: Validate Scaleway Serverless Containers deployment
---

# Scaleway deployment validation

## Goal and acceptance criteria

Deploy the whole app (frontend and API from one container) to Scaleway
Serverless Containers, which charges no egress, behind a Cloudflare loading
Worker, following drum-transcribe's `plokkaus.vempai.men` setup. Audio is
streamed through, never stored, so nothing is lost when the container scales
to zero. Validate yt-dlp against YouTube from Scaleway IPs, full audio
streaming through the Cloudflare proxy and the cold-start loading page.

## Plan (2026-09-26)

In the repository (done):

- `deploy/Dockerfile` builds from the repository root and copies
  `frontend/` next to the backend, so the container serves the page and
  `/api/*` on one origin; `frontend/config.js` stays empty.
- `GET /api/health` is a cheap, side-effect-free probe for the loading page.
- `deploy/cloudflare/worker.js` and `wrangler.toml` (Worker
  `dallape-front`, route `dallape.vempai.men/*`) show a "Starting up…" page
  for page loads not answered within 2.5 s, the same code as
  drum-transcribe's `plokkaus-front` except the probe URL and styles.

On a host with Scaleway and Cloudflare credentials (atom, like
drum-transcribe), done 2026-09-26 (see "Result (2026-09-26)"):

1. Scaleway (region `fr-par`): create a registry namespace `dallape`, a
   containers namespace `dallape` and a container `app` with the settings
   listed under "Container assumptions" below, except that
   `ALLOWED_ORIGINS` is no longer needed for the frontend. Build and push:
   `podman build -f deploy/Dockerfile -t rg.fr-par.scw.cloud/dallape/app:latest .`
   then `podman push …` and deploy. Check `/`, `/api/health` and one
   `/api/formats` + full `/api/audio` on the container's own
   `*.functions.fnc.fr-par.scw.cloud` URL.
2. Add `dallape.vempai.men` as a custom domain on the container, then
   create a CNAME `dallape` in the `vempai.men` zone pointing at the
   container endpoint, first "DNS only" so Scaleway can issue its
   certificate, then "Proxied" (zone SSL mode is already "Full").
3. `cd deploy/cloudflare && npx wrangler@4 deploy` with a token that can
   edit Workers and DNS for `vempai.men` (drum-transcribe's
   `.secrets.cloudflare.env` on atom already has one).
4. Via the Cloudflare API, create the no-Worker route
   `POST /zones/<zone>/workers/routes` `{"pattern": "dallape.vempai.men/api/*"}`
   and set `request_limit_fail_open: true` on the main route.
5. Verify in a browser: a cold start shows the loading page and reloads into
   the app; formats load; a long track streams completely and plays.

Cloudflare limits to keep in mind: an origin must send its first byte within
100 s (error 524), which a streamed `/api/audio` does after one extraction;
and Cloudflare caches `.js`/`.css` by default, so purge the cache (or wait)
after deploying frontend changes. `/api/audio` has no file extension and is
not cached. Rollback: set the DNS record back to "DNS only".

## Result (2026-09-26)

Steps 1–4 are done on atom, and step 5 is done except for the loading page
(see "Cold start" below). The app runs at https://dallape.vempai.men/.

Credentials: the existing Scaleway CLI profile `drum-transcribe` on atom
(`~/.config/scw/config.yaml`). Its user API key targets the account's only
project, which is named `dallape`, and drum-transcribe's resources live in the
same project. No new project or API key was created. Cloudflare: the token in
drum-transcribe's `.secrets.cloudflare.env` on atom.

### Resources

Scaleway, region `fr-par`, project `dallape`
(`3bb36115-95a5-4ccf-9436-d39ab212fe62`):

| Resource | Name | ID |
|---|---|---|
| Registry namespace | `dallape` (private, `rg.fr-par.scw.cloud/dallape`) | `cb2eb80b-43db-4c86-bf2c-4d40fbec1f57` |
| Containers namespace | `dallape` | `cdc246d5-e759-46a2-88ed-a4e6014665b4` |
| Container | `app` | `3e5fe326-ad5a-4389-b8b8-e7fc9fccc7a1` |
| Custom domain | `dallape.vempai.men` | `454bbc45-b05e-4bd2-a96e-ae06d4ed22e4` |

Container settings: image `rg.fr-par.scw.cloud/dallape/app:latest`, public,
HTTP/1, port 8080, sandbox v2, 1 GB RAM (`memory-limit-bytes=1GB`; the CLI
refuses plain byte counts), 560 mvCPU, `min-scale=0`, `max-scale=2`,
`scaling-option.concurrent-requests-threshold=20`, timeout 900 s. No
environment variables: `ALLOWED_ORIGINS` keeps its default `*`, because the
frontend is same-origin. Container URL:
https://dallapecdc246d5-app.functions.fnc.fr-par.scw.cloud

Cloudflare, zone `vempai.men` (`3fa2d208da5e2dfccce10a401b4036fa`):

| Resource | Details | ID |
|---|---|---|
| DNS record | CNAME `dallape` → `dallapecdc246d5-app.functions.fnc.fr-par.scw.cloud`, proxied, TTL 300 | `511874a27742fc3cb559fa849812ae03` |
| Worker | `dallape-front`, first version `d39480dd-3b36-4b39-b542-e254f0977513` | — |
| Route | `dallape.vempai.men/*` → `dallape-front`, `request_limit_fail_open: true` | `bc65668c41f04760bfeffdfc7e821da6` |
| Route | `dallape.vempai.men/api/*` → no Worker | `4e9caeaff4ec408fb7a166a1ed9bcb1d` |

Order used: the CNAME was created as "DNS only". The Scaleway domain then
became `ready` within about 10 s, and its certificate verified over plain
DNS. Only after that was the record switched to "Proxied".

### Checks

Test videos: "Me at the zoo" (`jNQXAC9IVRw`, 19 s), Big Buck Bunny
(`aqz-KE-bpKQ`, 10:35) and "Muti Conducts Beethoven 9" (`rOjHhS5MtvA`,
1:21:23).

- yt-dlp works from Scaleway's IPs without cookies. Every `/api/formats` call
  succeeded, and no bot check was hit.
- On the container URL: `/` 200 in 0.2 s, `/api/health` 200 in 0.14 s,
  `/api/formats` 1.8–3.2 s. Full `/api/audio` of Big Buck Bunny, formats 251
  and 140: 10 202 210 and 10 271 496 bytes, exactly the formats' `filesize`.
  First byte after 2.1 s, total 3.6 s, correct `Content-Type`,
  `Content-Length` and `Content-Disposition` (with `N kbps`).
- Through Cloudflare (`dallape.vempai.men`): `/api/formats` 1.6–1.8 s. The Big
  Buck Bunny 251 stream is byte-identical to the direct download
  (`cf-cache-status: DYNAMIC`). The 81-minute Beethoven track, format 251,
  streamed all 81 817 121 bytes with first byte after 1.9 s and total 14.8 s.
- Browser (headless Chromium via Playwright, on atom): the page loads, and
  picking "Opus 160 kbps" on the Beethoven video downloads the full 78.0 MB
  track in 13–16 s. After `playVideo` on the YouTube player, the `<audio>`
  element plays the Dallapé track (duration 4882.5 s). After a seek to
  1:20:50 it keeps advancing in step with real time.
- Pinchtab's browser was unusable for the playback check: its tab reports
  `visibilityState: hidden`, so Chrome never loads media or the YouTube
  player there.

### Cold start

After a 30-minute pause on our side the first page load still took 1.5 s
and got the app directly. The Cockpit logs show why: the first instance
(`…-00001-deployment-…-9svlm`, started 15:01:59 UTC) was still running,
because bots started scanning the new hostname within two minutes of its
certificate being issued (`/.env`, `/.git/HEAD`, `GET /` every few
minutes). Idle gaps of 8 and 13 minutes were not enough for Scaleway to
scale the container to zero. drum-transcribe's logs suggest a new instance
after about 15–20 idle minutes.

Not yet verified: a real cold start through the loading page. Bot requests
kept arriving at intervals of 2–10 minutes until at least 16:07 UTC, so the
instance never idled long enough. To measure, wait until Cockpit shows no
requests for 20 minutes (query `{resource_id="<container id>"}`), then load
the page in a browser. Expect either the "Starting up…" page followed by a
reload into the app, or, if Scaleway starts this small image in under 2.5 s,
the app directly. A new `resource_instance` name in the logs confirms that
the start was cold.

## Earlier attempts

The earlier attempt was blocked at provider deployment: the documented
Scaleway secret file exists and the image builds, but it provides only an access
ID and API key. Scaleway's project API requires an organization UUID; project
discovery returned HTTP 400 (`organization_id` is required/invalid), so no
project, registry namespace, or test service could be created.

The comma retry, Kandev task `44d28237-42c8-47fc-8eff-af059dbd0c92`,
retried task `5f5f0c2e-1492-41fc-bc30-4d7209808ebf` and reproduced the missing
global CLI (`command -v scw` failed). The comma path was available, so
`, scw container namespace list` was attempted.
Comma could not evaluate the Nix derivation because this environment cannot
connect to `/nix/var/nix/daemon-socket/socket` (`Operation not permitted`); it
also could not update its cache under `/home/agent/.local/state/comma` because
that path is read-only. No Scaleway API request or yt-dlp validation from a
Scaleway IP was possible. The command selection below remains usable on a host
where comma can resolve the CLI.
`frontend/config.js` remains unchanged; Cloud Run remains the fallback.

The retry attempt is complete, but deployment and remote validation remain
blocked. The CLI fallback and retry are separate completed tasks in
[TASKS.md](../../TASKS.md); neither establishes that Scaleway deployment succeeded.

## Container assumptions

The container (`deploy/Dockerfile`, formerly `backend/Dockerfile`) is compatible with a serverless container:
it listens on `0.0.0.0`, reads `PORT` with an 8080 fallback, has no persistent
state, and streams `/api/audio` through FastAPI `StreamingResponse`. The image
needs a registry push before deployment. Provider settings to validate when
credentials are available:

- public HTTP endpoint (`Privacy=public`);
- container port 8080, with the platform-injected `PORT` value passed through;
- request-concurrency autoscaling with `min-scale=0` for scale-to-zero and a
  bounded `max-scale` selected for the test;
- request concurrency selected explicitly so long audio streams do not create
  unnecessary instances;
- request timeout at least 900 seconds for long audio streams;
- `ALLOWED_ORIGINS=https://dallape.vempai.men`;
- `YTDLP_COOKIEFILE` only when a separately mounted secret is required.

## CLI invocation

Use the installed CLI when available. On NixOS, fall back to `comma` when
`scw` is not installed:

```bash
if command -v scw >/dev/null 2>&1; then
  SCW=(scw)
elif command -v , >/dev/null 2>&1; then
  SCW=(, scw)
else
  printf '%s\n' 'scw and comma are unavailable' >&2
  exit 1
fi

"${SCW[@]}" container namespace list
```

Use the same `"${SCW[@]}"` prefix for subsequent Scaleway commands. This
preserves direct `scw` execution on hosts where the CLI is installed and
allows NixOS hosts to resolve it through `comma`.

## Checks completed

- `python3 /home/agent/prg/syncop/tools/check_tasks_md.py TASKS.md` passes.
- `podman build -t dallape-backend:scaleway-check backend/` succeeds with the
  existing Dockerfile.
- `UV_CACHE_DIR=/tmp/dallape-uv-cache uv run pytest` starts successfully and
  exercises 22 tests; the sandbox command timed out while the suite was still
  running, so it is not recorded as a completed pass.
- `node --test frontend/tests/providers.test.js` passes (1 test).
- A live yt-dlp request was attempted from the available host and failed before
  contacting YouTube because sandbox DNS is unavailable:
  `Temporary failure in name resolution`. This does not prove access from
  Scaleway IP space.
- The existing unit tests cover the local endpoint's `StreamingResponse` path,
  including ranged reads and streamed chunks. A container-level timing result
  is unavailable because Podman cannot initialize its runtime in this sandbox
  (`/run/user/1002/libpod` is read-only).
- Record cold start as the first request after scale-to-zero and warm latency
  from a second request to `/api/formats`; do not point the frontend at the
  service unless both requests and an audio stream succeed.

The provider assumptions above come from Scaleway's [deployment guide],
[port documentation], [autoscaling reference], and [container limits].

## Follow-up

Done on 2026-09-26; see "Result (2026-09-26)" above. No `frontend/config.js`
change was needed.

[deployment guide]: https://www.scaleway.com/en/docs/serverless-containers/api-cli/deploy-container-cli/
[port documentation]: https://www.scaleway.com/en/docs/serverless-containers/reference-content/port-parameter-variable/
[autoscaling reference]: https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-autoscaling/
[container limits]: https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-limitations/
