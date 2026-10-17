# Gather acceptance evidence for the 5 legacy review-queue items

Steward issue, 2026-10-17 (decisions D7, D10 and D37 in
`/home/agent/my-knowledge/agents/steward/decisions.md`). It takes over
dallape's part of vault [20]. The vault's tracker is blocked, so this check
runs here, in the repository it checks. The verdicts feed the steward's next
digest, so that Antti can accept or reject these items with less checking of
his own.

## Items

These `- [ ]` items under `## Completed / Accepted`:

- [1], the Scaleway Serverless Container deployment behind a Cloudflare loading
  Worker.
- Four `[*]` bullets: retrying with `, scw`, using `, scw` on NixOS hosts
  without `scw`, the `Dockerfile` for Cloud Run, Fly.io or a VPS, and `N kbps`
  in downloaded file names.

Items whose Hai metadata has no `updatedAt` (it starts with 1970 in `hai-tasks
read`) are legacy bullets that predate Hai timestamps. Judge them against
today's `main`: find the commits that delivered each one (`git log -S`,
`--grep`, its description under `docs/tasks/`) and check that the behaviour
still exists. An item superseded by later work is "would accept" only when the
later work covers its request; name the issue that superseded it.

## Work

Run the test suite that the README or AGENTS.md documents once on current
`main`, and a targeted test wherever an issue names one. Deployment is always
left to Antti: for [1] and the `scw` items, record what the repository shows
and run nothing against Scaleway or Cloudflare. Build the `Dockerfile` only if
Docker or Podman runs without root here; otherwise say so. Check criterion 3
with `git revert --no-commit` of an item's merge commits in a temporary
worktree (`git worktree add --detach "$TMPDIR/revert-check" main`, removed
afterwards); conflicts only in `TASKS.md` and `docs/tasks/` don't count.

For each item, record one line: issue, a one-line outcome, the evidence
(commits, files, test command with pass and fail counts) and a verdict under
`/home/agent/my-knowledge/agents/steward/acceptance-policy.md`:

- **would accept:** all four criteria hold; give the revert command;
- **left to Antti:** name the criterion or the "Always left to Antti" class;
- **not done:** say what is missing.

## Deliverable

A section `## Evidence, YYYY-MM-DD` in this description file, with the lines
grouped by verdict and the counts per verdict at the end.

## Ground rules

- Change no other issue's state or text, and never change `[ ]` to `[x]`: only
  Antti accepts.
- Don't push, deploy or restart services, and don't touch the vault or the
  running pacer.

## Acceptance

- Every listed item has a line with evidence and a verdict.
- Nothing outside this file and the issue's own tracker moves changed.


## Evidence, 2026-10-17

Checked local `main` at `1c0271c364ed7d6596811d8b92a279b6cd6df1c7`,
without fetching or contacting Scaleway, Cloudflare or the live app. All five
items have Hai `updatedAt=1970-01-01T00:00:00.000Z`; their implementation
history and current files, rather than those timestamps, determine the findings.
Policy: `/home/agent/my-knowledge/agents/steward/acceptance-policy.md`, shadow
mode. These are recommendations only; all five acceptance boxes remain `[ ]`.

Validation on an unmodified detached worktree of that `main`:

- Backend, from `backend/`: `uv run pytest`, **23 passed, 0 failed**, one
  Starlette/AnyIO deprecation warning, Python 3.14.7.
- Frontend, from the repository root: `node --test frontend/tests/*.test.js`,
  **3 passed, 0 failed**. The specifically documented command
  `node --test frontend/tests/providers.test.js` also gave **3 passed, 0 failed**.
- Targeted backend checks, from `backend/`:
  `uv run pytest tests/test_app.py::test_download_filename_encodes_title_and_includes_bitrate tests/test_app.py::test_audio_streams tests/test_app.py::test_health`,
  **3 passed, 0 failed**. Audio extraction and streaming use fixtures, not providers.
- Rootless availability: `podman info --format '{{.Host.Security.Rootless}}'`
  returned `true`, UID 1002; Docker was unavailable. From the repository root,
  `podman build -f deploy/Dockerfile -t localhost/dallape-acceptance-evidence:hai-2 .`
  **1 build passed, 0 failed**, image `7bfb9d03d4aa`.
- An ad hoc `podman run` probe used that image with `--rm --network=none`,
  `PORT=8097`, and the Dockerfile's shell/uvicorn startup command. Container-local
  HTTP assertions for `/api/health`, `/` and `/app.js` gave **3 passed, 0 failed**;
  the health JSON, frontend HTML and JavaScript containing `kbps` were present.
- An ad hoc Python/Bash probe extracted the documented CLI-selection snippet
  from `docs/tasks/1-scaleway-deployment.md`. With isolated fake executables
  on `PATH`, installed `scw`, comma-only and neither-installed cases gave
  **3 passed, 0 failed**. No real CLI or provider command ran. The first probe
  invocation could not start `/bin/bash` on NixOS; rerunning with the installed
  Bash executable produced these results.

Each revert below ran independently from the same clean `main`, using
`git worktree add --detach "$TMPDIR/revert-check" main` inside a fresh temporary
directory. After recording conflicts and staged changes, the disposable worktree
was reset to `main`; it was removed after validation. Conflicts confined to
`TASKS.md` and `docs/tasks/` were ignored as the policy requires. No conflict
was manually resolved to manufacture a clean result.

### Left to Antti

- **[1] Scaleway container behind a Cloudflare loading Worker: left to Antti.** Current code implements same-origin frontend/API serving, `/api/health`, a 2.5-second loading-page threshold and health polling; `11da77e`, merge `ed21b80`, and deployment record `db6feca` supply the evidence in `deploy/Dockerfile`, `deploy/cloudflare/worker.js`, `deploy/cloudflare/wrangler.toml`, `backend/app.py` and `docs/tasks/1-scaleway-deployment.md`. Backend `uv run pytest`: 23 passed, 0 failed; targeted health/filename/stream checks: 3 passed, 0 failed; frontend command above: 3 passed, 0 failed. The recorded 2026-09-26 deployment streamed complete audio directly and through Cloudflare, but explicitly leaves a real cold start/loading-page check unverified. Always-left classes: deployment and unverified work, criterion 1 remains incomplete for that live check. Criterion 3 also fails: `git revert --no-commit -m 1 ed21b80` exits 1 with a substantive `README.md` conflict, besides exempt tracker/description conflicts. No deployment or live validation was attempted here.
- **[*] Retry task `5f5f0c2e-1492-41fc-bc30-4d7209808ebf` with `, scw` / Hai `simple-aba86ff90c08e177`: left to Antti.** `bd968c7`, merge `87ba40a`, records the actual comma retry, Kandev task `44d28237-42c8-47fc-8eff-af059dbd0c92`, in `docs/tasks/1-scaleway-deployment.md`; comma was selected, but Nix-daemon access and a read-only comma cache blocked evaluation before any Scaleway API request. Backend `uv run pytest`: 23 passed, 0 failed; documented frontend test: 3 passed, 0 failed; local fake-command selection probe: 3 passed, 0 failed. The retry attempt is documented, and later issue [1], `db6feca`, covers deployment and remote streaming, while its cold-start verification remains outstanding. `git revert --no-commit -m 1 87ba40a` exits 1 with only exempt `TASKS.md` and description conflicts, so criterion 3 passes under the exception. Always-left classes: deployment and work reported blocked; no provider retry was performed here.
- **[*] Use `, scw` on NixOS when `scw` is absent / Hai `simple-2de8a3a262512c88`: left to Antti.** `878bee8` and `974e7a3`, merge `ee5a8f3`, deliver the Bash array fallback still present under “CLI invocation” in `docs/tasks/1-scaleway-deployment.md`; README redeployment instructions also use `, scw`. The isolated fake-command probe confirms direct `scw`, comma fallback and a clear failure when neither exists: 3 passed, 0 failed. Backend `uv run pytest`: 23 passed, 0 failed; documented frontend test: 3 passed, 0 failed. `git revert --no-commit -m 1 ee5a8f3` exits 1 with only an exempt `TASKS.md` conflict and stages removal of the fallback description, so criterion 3 passes under the exception. The documented behavior survives, but actual comma resolution/provider execution remains unverified here; the task explicitly reserves the `scw` deployment class to Antti.
- **[*] Dockerfile for Cloud Run, Fly.io or a VPS / Hai `simple-87d137b900ac5652`: left to Antti.** The original Dockerfile was already in `8d5025d`; `0580a3d`, merge `8e1d8b0`, added deployment instructions and build-context exclusions. Later issue [1], `11da77e` / merge `ed21b80`, supersedes `backend/Dockerfile` with `deploy/Dockerfile` and retains generic hosting support: bind `0.0.0.0`, configurable `PORT`, fallback 8080, stateless API and streaming. README still names Cloud Run, Fly.io and a VPS. Current rootless `podman build -f deploy/Dockerfile -t localhost/dallape-acceptance-evidence:hai-2 .`: 1 passed, 0 failed; offline container smoke checks: 3 passed, 0 failed; backend `uv run pytest`: 23 passed, 0 failed; frontend command above: 3 passed, 0 failed. Local build/runtime evidence meets the requested behavior, but criterion 3 fails: `git revert --no-commit -m 1 8e1d8b0` conflicts in `README.md` beyond exempt `TASKS.md`; reverting the superseding `ed21b80` also conflicts in `README.md`. Acceptance needs Antti's judgment of this historical overlap.
- **[*] Include `N kbps` in downloaded filenames / Hai `simple-17dcd69e10062d36`: left to Antti.** `f7cf711`, merge `824952a`, still supplies encoded backend `Content-Disposition` names through `download_filename` in `backend/app.py` and browser Blob download names in `frontend/app.js`; both include the selected bitrate. Backend `uv run pytest`: 23 passed, 0 failed; targeted filename/stream/health command above: 3 passed, 0 failed, including `Never%20%2F%20Gonna%20160%20kbps.webm` and its response header; frontend suite: 3 passed, 0 failed, although it tests providers rather than clicking a download. No later issue supersedes this behavior. Criterion 3 fails: `git revert --no-commit -m 1 824952a` conflicts in `backend/tests/test_app.py`, besides exempt `TASKS.md`; the backend and frontend implementation reversals themselves stage cleanly. The test-file conflict is outside the policy exception and needs Antti's judgment.

The implementation/history review found no unrelated additions or data destruction
in the delivered changes, criteria 2 and 4. The later Dockerfile relocation keeps
the original hosting functionality. Passing local tests does not establish live
provider behavior or resolve the non-exempt revert conflicts.

Counts: **would accept 0; left to Antti 5; not done 0.** No legacy issue state or
text was changed.
