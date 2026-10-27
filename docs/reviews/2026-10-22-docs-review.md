# Documentation review, 2026-10-22

Reviewed local `main` at `6aa4536fe81a3c13bdeebdc8060fc1bc1226fc9c`,
including the committed start move for [the documentation audit]. The worktree
was rebased onto that commit before the baseline tests. This is a source and
text audit, not a new production or browser certification.

## Coverage

All three Markdown files selected by `git ls-files '*.md'`, excluding
[docs/tasks/], [docs/reviews/] and [TASKS.md], were read, in this order:

- **[README.md]:** commands, defaults, deployment claims, API, playback and
  retention checked against the current application, configuration and build.
- **[frontend/tests/fixtures/README.md]:** checked against the six captured
  rows in [frontend/tests/fixtures/youtube-multilingual.json], backend projection
  tests and frontend metadata tests. No new live capture was attempted.
- **[docs/2026-09-19-architecture-review-and-remediation-plan.md][old review]:**
  read in full, including its 2026-10-19 status appendix. Its statements that
  retention is unbounded, format metadata is discarded, retries stay poisoned
  and no browser integration helper exists describe earlier snapshots.
  `reserve`, `retireTrack`, `loadFormats` and `pick` in [frontend/app.js], plus
  [tools/check_audio_browser.mjs], now implement those missing parts. Preserved
  the dated text; [README.md] directs readers to the later [architecture
  recheck] and this review. Image, public-capacity and cookie work remain open.

All module/function docstrings and comments in the eleven tracked Python and
JavaScript sources, including the `.mjs` helper, were read against their bodies:

- **Backend:** [backend/app.py], [backend/tests/test_app.py],
  [backend/tests/test_stream.py]. The first test file has no docstrings/comments;
  the stream-test module's boundary/Uvicorn description is accurate.
- **Frontend:** [frontend/app.js], [frontend/config.js],
  [frontend/providers.js], [frontend/tests/app.test.js],
  [frontend/tests/providers.test.js]. The application-test comments match their
  assertions; provider tests have no comments/docstrings.
- **Deployment and tools:** [deploy/cloudflare/worker.js],
  [tools/check_audio_browser.mjs], [tools/check_tasks_md.py].

Also checked [frontend/index.html], [backend/pyproject.toml], [backend/uv.lock],
[deploy/Dockerfile], [deploy/cloudflare/wrangler.toml] and [.dockerignore].
Cookie/cache statements were verified against the locally installed, locked
yt-dlp `2026.8.19`: `YoutubeDL.close/save_cookies`, `YoutubeDLCookieJar.save` and
`Cache._get_root_dir/enabled`. No real credentials were read.

## Changes and code evidence

- **[README.md]:** shortened the entry point to actual usage and links. Removed
  the duplicate lifecycle/API explanations and obsolete frontend/backend table.
  `startApp`, `render` and `fetchTrack` in [frontend/app.js] supply the described
  controls, progress, completed downloads and tab cache; [frontend/index.html]
  supplies the form. Detailed contracts now have one home in the two guides.
- **[docs/audio-contract.md]:** consolidated format discovery, playback/retry,
  cache and HTTP contracts formerly scattered through the README. `loadFormats`
  shares pending metadata, retries failure and keeps authoritative metadata;
  `fetchTrack` fetches bytes and measures progress, with no progress endpoint.
  `maybeSwitch`, `failAudio` and `syncAudio` establish attachment, continued
  downloading, Blob retry and decoded readiness. `reserve`, `retireTrack` and
  the submission handler establish byte/video accounting and cancellation.
  `startApp` reads settings once, so changing any cache setting needs a reload.
  [backend/app.py]'s `parse_youtube`, `audio_formats`, `download_filename`,
  `formats`, `audio`, `read_chunks` and `AudioResponse` establish supported
  inputs, fields, units, errors, filenames, MIME, timeouts and stream framing.
  Corrected the server-cache implication: `audio` re-extracts each request.
  Replaced broad statelessness with no stored media/durable application data;
  `ydl_opts` leaves dependency cache/cookie writes enabled. Added the legacy
  `/v/` input and health/OpenAPI entry points. Limited the generic-502 statement
  to the exception types actually caught.
- **[docs/development.md]:** separated root-level test commands from the blocking
  server, used frozen dependency resolution and recorded tested Python/Node
  versions. Commands match [backend/pyproject.toml], the test locations and
  [backend/app.py]'s static mount. Explained the optional browser helper's
  actual dependencies and fake-player/whole-response limits. Configuration
  matches `startApp`, `ydl_opts`, CORS setup and [deploy/Dockerfile]'s `PORT`
  entry command. The Worker description now includes fetch failures and
  statuses at least 502, as its `fetch` handler does; API bypass depends on the
  separately recorded route, absent from [deploy/cloudflare/wrangler.toml].
  Registry/profile requirements and deployment commands remain linked to the
  [deployment record], without presenting dated measurements as new checks.
  Linked existing open release/cookie work instead of implying it is complete.
- **[backend/app.py]:** module docstring now qualifies filesystem state, matching
  `ydl_opts`, `extract`, `read_chunks` and the locked dependency methods above.
  `read_chunks` now explicitly documents failure without retries; its loop
  advances only after a verified response and its exception handler terminates.
- **[frontend/app.js]:** `pick`'s comment no longer says metadata is fetched only
  on the first click: `finally` clears the failed lookup for a later retry.
  `reserve`'s comment no longer implies runtime measurement of decoder/transport
  allocations. `failAudio`'s docstring attributes Blob retry to a later selection,
  matching `wanted = null`, `blobOnly = true` and `maybeSwitch`'s guard.
- **[frontend/config.js]:** clarified that positive safe integer validation
  applies to `maxVideos`/`maxBytes`, and settings require reload, matching
  `startApp`'s `limit` helper and startup constants.
- **[frontend/providers.js]:** `parseVideo`'s docstring specifies YouTube and the
  actual `{provider: "youtube", id}` return shape, matching both return paths.
- **[deploy/cloudflare/worker.js]:** replaced the cold-start-only explanation
  with its navigation timeout/failure/status behavior and the external route
  requirement. The handler itself has no `/api/*` path exclusion.
- **[tools/check_tasks_md.py]:** corrected the module contract to normalized
  text across different headings, the first separator, one removed bracketed
  marker, and usage exit status. These match `read_issue_headings`,
  `find_duplicates` and `main`; neither issue identity nor repetition within
  one heading is validated. No checker behavior was changed.
- **[tools/check_audio_browser.mjs]:** comment now names external Chromium as
  well as Playwright and ffmpeg, matching the import, `chromium.launch` and
  `execFileSync` calls. No check logic was changed.
- **[frontend/tests/fixtures/README.md]:** added relative reference links to
  the fixture and its backend projection. `audio_formats` and
  `download_filename` are checked by `test_captured_multilingual_contract_and_audio_selection`
  in [backend/tests/test_app.py]. Historical capture claims are unchanged.
- **[The documentation audit][the documentation audit]:** appended only an
  execution/resource record required by the task workflow. The original brief
  remains intact. Other task files, earlier reviews and the dated architecture
  review are unchanged. This new review records the audit and evidence.

## Unresolved questions

- **Q1 — displayed size units:** `fmtSize` in [frontend/app.js] divides by
  `1048576` but labels the result `MB`; configuration and the cache contract
  correctly use MiB. It is unclear whether the intended UI unit is decimal
  megabytes or binary mebibytes. Changing the rendered string or divisor exceeds
  the document/docstring/comment scope.

  **Recommendation:** keep binary accounting and label these sizes `MiB`, with
  a focused display assertion when the steward schedules that UI change.
- **Q2 — cookie mode's intended contract:** `ydl_opts` passes a shared filename
  to context-managed yt-dlp instances, whose close path saves the file. The
  old README advertised the setting without the writable-file/account boundary.
  Current behavior is now documented, but whether to retain authenticated
  content access or require anonymous service is a policy question.

  **Recommendation:** resolve it under the existing [public-service and
  cookie-policy task]; do not treat this documentation pass as implementing
  immutable cookie input, per-request isolation or caller authorization.

## Verification

Baseline and final application checks use the same frozen lock and unmodified
tests. Python 3.14.7, pytest 9.1.1 and Node v24.21.0 were used.

- **Backend:** `uv run --frozen pytest` from [backend/] passes all 70 cases
  before and after the edits, including real Uvicorn HTTP framing tests. Both
  runs report the same dependency deprecation warning for
  `anyio.abc.BlockingPortal` in Starlette's test client.
- **Frontend:** `node --test frontend/tests/*.test.js` from the repository root
  passes all 39 tests before and after, with zero failures, skips or cancellations.
- **Tracker:** `python3 tools/check_tasks_md.py TASKS.md` passes on the baseline
  and final worktree; completion-move results are in [the execution record].
- **Text-only scope:** executable Python ASTs match baseline after stripping
  docstrings; every JavaScript edit is a comment-only diff. Tests and fixture
  data match baseline byte-for-byte. No dependency, configuration value, build
  recipe or rendered application string was changed.
- **Existing Python diagnostics:** automatic edit checks invoked Ruff and ty.
  Explicit comparison with canonical main reproduced the same Ruff I001,
  SIM102 and BLE001 in [backend/app.py], EXE001 in [tools/check_tasks_md.py], and
  two ty `unsupported-operator` errors for nullable `end` arithmetic in
  `read_chunks`. Both tools exit 1 on both trees. These are pre-existing
  failures; this review does not claim a clean lint/type gate or alter code
  to silence them. The comparison itself passed.

The [execution record] records final Markdown/link, startup and whitespace
checks, memory admission/monitoring and merge/completion details. Live YouTube,
container builds, cloud deployment and the optional browser fixture run were
outside this text audit; no new success is claimed for those release gates.

## Draft issues

- **Size-unit label:** Q1 is a small UI/test follow-up for the steward; no issue
  was filed and the current rendered string was left unchanged.
- **Existing lint/type failures:** decide whether to repair or explicitly
  configure the four Ruff findings and two ty findings before treating those
  tools as release gates. Preserve stream error sanitization when considering
  the broad exception handler; its purpose is already tested.
- **Existing release work:** retain the [release-image task], [public-service
  and cookie-policy task] and [release-gate task] for reproducible
  challenge-capable images, public resource/account policy and live validation.
  This audit supplies current documentation but does not complete those tasks.
  No duplicate issues were filed.

[README.md]: ../../README.md
[docs/tasks/]: ../tasks/
[docs/reviews/]: ./
[TASKS.md]: ../../TASKS.md
[old review]: ../2026-09-19-architecture-review-and-remediation-plan.md
[architecture recheck]: 2026-10-21-architecture-recheck.md
[docs/audio-contract.md]: ../audio-contract.md
[docs/development.md]: ../development.md
[frontend/tests/fixtures/README.md]: ../../frontend/tests/fixtures/README.md
[frontend/tests/fixtures/youtube-multilingual.json]: ../../frontend/tests/fixtures/youtube-multilingual.json
[frontend/app.js]: ../../frontend/app.js
[frontend/config.js]: ../../frontend/config.js
[frontend/providers.js]: ../../frontend/providers.js
[frontend/index.html]: ../../frontend/index.html
[frontend/tests/app.test.js]: ../../frontend/tests/app.test.js
[frontend/tests/providers.test.js]: ../../frontend/tests/providers.test.js
[backend/]: ../../backend/
[backend/app.py]: ../../backend/app.py
[backend/tests/test_app.py]: ../../backend/tests/test_app.py
[backend/tests/test_stream.py]: ../../backend/tests/test_stream.py
[backend/pyproject.toml]: ../../backend/pyproject.toml
[backend/uv.lock]: ../../backend/uv.lock
[deploy/Dockerfile]: ../../deploy/Dockerfile
[deploy/cloudflare/worker.js]: ../../deploy/cloudflare/worker.js
[deploy/cloudflare/wrangler.toml]: ../../deploy/cloudflare/wrangler.toml
[.dockerignore]: ../../.dockerignore
[tools/check_audio_browser.mjs]: ../../tools/check_audio_browser.mjs
[tools/check_tasks_md.py]: ../../tools/check_tasks_md.py
[deployment record]: ../tasks/1-scaleway-deployment.md
[release-image task]: ../tasks/7-verify-a-reproducible-youtube-capable-release-image.md
[public-service and cookie-policy task]: ../tasks/8-bound-public-audio-work-and-decide-safe-cookie-policy.md
[release-gate task]: ../tasks/11-document-actual-contracts-and-finish-the-existing-release-gate.md
[the documentation audit]: ../tasks/15-check-dallape-s-documents-docstrings-and-comments-against-current-main.md
[the execution record]: ../tasks/15-check-dallape-s-documents-docstrings-and-comments-against-current-main.md#execution-record-2026-10-22
[execution record]: ../tasks/15-check-dallape-s-documents-docstrings-and-comments-against-current-main.md#execution-record-2026-10-22
