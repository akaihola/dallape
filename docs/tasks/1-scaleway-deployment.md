---
title: Validate Scaleway Serverless Containers deployment
---

# Scaleway deployment validation

## Result

Blocked at provider deployment: this workspace has no Scaleway credentials,
project, registry image, or `scw` CLI configuration. A test service therefore
could not be created, and yt-dlp could not be validated from a Scaleway IP.
`frontend/config.js` remains unchanged; Cloud Run remains the fallback.

## Container assumptions

The existing `backend/Dockerfile` is compatible with a serverless container:
it listens on `0.0.0.0`, reads `PORT` with an 8080 fallback, has no persistent
state, and streams `/api/audio` through FastAPI `StreamingResponse`. The image
needs a registry push before deployment. Provider settings to validate when
credentials are available:

- public HTTP endpoint and unauthenticated invocation;
- container port 8080, with the platform `PORT` value passed through;
- scale-to-zero enabled and one active request minimum;
- request timeout at least 900 seconds for long audio streams;
- `ALLOWED_ORIGINS=https://dallape.vempai.men`;
- `YTDLP_COOKIEFILE` only when a separately mounted secret is required.

## Checks completed

- `python3 /home/agent/prg/syncop/tools/check_tasks_md.py TASKS.md` passes.
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

## Follow-up

With Scaleway access, build and push `backend/`, deploy the image using the
settings above, run the three remote checks, and compare cold start, streaming,
and yt-dlp success with the existing Cloud Run service. Only then set
`window.DALLAPE_API_BASE` in `frontend/config.js` to the Scaleway URL.
