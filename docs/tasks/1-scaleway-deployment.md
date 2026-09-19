---
title: Validate Scaleway Serverless Containers deployment
---

# Scaleway deployment validation

## Goal and acceptance criteria

Deploy the backend to Scaleway Serverless Containers, which charges no egress, as
a cheaper alternative to Cloud Run. Validate yt-dlp against YouTube from Scaleway IPs,
response streaming and cold start before pointing `frontend/config.js` at it. Keep
Cloud Run as the fallback.

## Result

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

The existing `backend/Dockerfile` is compatible with a serverless container:
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

With Scaleway access, build and push `backend/`, deploy the image using the
settings above, run the three remote checks, and compare cold start, streaming,
and yt-dlp success with the existing Cloud Run service. Only then set
`window.DALLAPE_API_BASE` in `frontend/config.js` to the Scaleway URL.

[deployment guide]: https://www.scaleway.com/en/docs/serverless-containers/api-cli/deploy-container-cli/
[port documentation]: https://www.scaleway.com/en/docs/serverless-containers/reference-content/port-parameter-variable/
[autoscaling reference]: https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-autoscaling/
[container limits]: https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-limitations/
