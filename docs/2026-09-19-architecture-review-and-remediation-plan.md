Architecture review complete and ready for user review. The full evidence and ordered remediation plan follow. Review and planning only; implementation, deployment, further tasks and tracker changes remain outside this task's authorization.

# Dallapé architecture review and remediation plan

Review completed 2026-09-19 against commit `7abab234f562d2ea8a89728ceff69dd58a940318`. Task `228d63ed-4bfa-4b02-a102-59c1205cbb7f`, session `66f23621-87ab-489e-9ea7-2f3e885d4513`. Kandev confirms Astra Medium and Priority Kanban. Ready for user review. This plan does not authorize implementation, deployment, or additional tasks.

## Architecture and coverage

Dallapé compares and downloads YouTube audio encodings while a YouTube iframe supplies the video. Its small static-client/stateless-proxy split fits that purpose. Keep it. A database, job queue, frontend framework, transcoding service, or provider abstraction would not resolve the observed failures.

All 17 tracked files were inspected, including the lockfile's package graph, build inputs, both test files, all documentation, and tracker tooling. No repository or ancestor AGENTS.md was found in the checked workspace ancestry; the user-provided Bash instructions apply. There are no checked-in CI workflows, infrastructure manifests, separate design records, migrations, or browser integration tests. README is the design narrative; docs/tasks/ contains only the Scaleway validation document. Initial and final repository status were clean; no repository files were changed. Review probes and attempted dependency installation used /tmp.

| Area | Responsibility and boundaries | Evidence |
| --- | --- | --- |
| Static entry | HTML loads config then JavaScript modules; CSS controls layout; YouTube iframe script is an external runtime dependency | [frontend/index.html](https://gogo.crane-boa.ts.net:8449/t/frontend/index.html):7-24; [frontend/config.js](https://gogo.crane-boa.ts.net:8449/t/frontend/config.js):1-3; [frontend/style.css](https://gogo.crane-boa.ts.net:8449/t/frontend/style.css):1-25 |
| Provider parsing | Ten speculative audio format columns, YouTube URL/ID recognition; no third-party frontend packages | [frontend/providers.js](https://gogo.crane-boa.ts.net:8449/t/frontend/providers.js):3-40 |
| Client orchestration | DOM, request deduplication, per-video cache, streamed chunks, Blob downloads, MediaSource attachment, 250 ms synchronization all share module state | [frontend/app.js](https://gogo.crane-boa.ts.net:8449/t/frontend/app.js):3-198 |
| API entry | GET /api/formats and GET /api/audio; FastAPI handles query validation; local-only static mount | [backend/app.py](https://gogo.crane-boa.ts.net:8449/t/backend/app.py):97-142 |
| Extraction boundary | Backend independently validates IDs, constructs a canonical YouTube URL, and restricts yt-dlp extractors; only audio-only HTTP/HTTPS formats pass | [backend/app.py](https://gogo.crane-boa.ts.net:8449/t/backend/app.py):16-54,66-74,106-113 |
| Streaming | Each audio request re-extracts metadata, selects an allowed format and streams upstream bytes, optionally using manual ranges; no media file stored by application | [backend/app.py](https://gogo.crane-boa.ts.net:8449/t/backend/app.py):77-94,127-137 |
| Dependencies/build | Python >=3.12; FastAPI, Uvicorn, yt-dlp; pytest/httpx2 development dependencies; 25 lock entries including root project. Docker uses Python 3.12, frozen production dependencies, mutable uv base tag, port 8080 fallback | [backend/pyproject.toml](https://gogo.crane-boa.ts.net:8449/t/backend/pyproject.toml):1-12; [backend/uv.lock](https://gogo.crane-boa.ts.net:8449/t/backend/uv.lock):1-361; [backend/Dockerfile](https://gogo.crane-boa.ts.net:8449/t/backend/Dockerfile):1-6 |
| Configuration/persistence | API base is a public static setting. CORS defaults to \\*. Optional backend cookie-file credential. Client cache is tab memory with object URLs, lost on reload. No database or migration mechanism. yt-dlp may also use filesystem cache and write cookies; “stateless” means no required durable application state | [frontend/app.js](https://gogo.crane-boa.ts.net:8449/t/frontend/app.js):7,95-113; [backend/app.py](https://gogo.crane-boa.ts.net:8449/t/backend/app.py):39-49,100; [README.md](https://gogo.crane-boa.ts.net:8449/t/README.md):97-123 |
| Operations/backlog | CDN frontend and separate backend; local backend can serve both. Cloud Run, Fly/VPS instructions; Scaleway remains blocked pending credentials/environment and remote validation | [README.md](https://gogo.crane-boa.ts.net:8449/t/README.md):75-132; [TASKS.md](https://gogo.crane-boa.ts.net:8449/t/TASKS.md):13-26; [docs/tasks/1-scaleway-deployment.md](https://gogo.crane-boa.ts.net:8449/t/docs/tasks/1-scaleway-deployment.md):14-54,102-107 |
| Verification/tooling | Backend parser, filtering, filenames, mocked endpoints and ideal ranges; frontend parser/table only; duplicate-bullet checker. Ignore files keep common generated files out; Docker copies only manifest, lock and app | [backend/tests/test\\_app.py](https://gogo.crane-boa.ts.net:8449/t/backend/tests/test_app.py):1-98; [frontend/tests/providers.test.js](https://gogo.crane-boa.ts.net:8449/t/frontend/tests/providers.test.js):1-33; [tools/check\\_tasks\\_md.py](https://gogo.crane-boa.ts.net:8449/t/tools/check_tasks_md.py):1-87; .gitignore; backend/.dockerignore |

### Critical paths traced

1.  Preview: form submit -> parseVideo -> stopAudio -> select cached video state -> await iframe API/player -> render. No backend request until a format click. Player API failure has no timeout or visible recovery.
2.  First selection: pick -> shared loadFormats promise -> GET /api/formats -> video\_info -> parse\_youtube -> extract -> audio\_formats -> client retains only format IDs -> fetchTrack. Subsequent selections reuse metadata and track entries.
3.  Streaming/download: GET /api/audio repeats extraction -> format allowlist -> read\_chunks opens upstream -> StreamingResponse -> browser reader retains chunks -> optional MediaSource queue -> completed Blob/object URL -> local download. Re-extraction deliberately avoids persisting expiring upstream URLs, at the cost of another provider request per track.
4.  Playback: received-byte fraction estimates time coverage -> maybeSwitch mutes iframe -> attachTrack -> syncAudio follows iframe time/play state. Playback speed, actual decoded coverage and failures are not coordinated.
5.  Failure/navigation: rejected format promise is retained; failed tracks are deleted but active audio is not reset; a pending pick can operate on the previous video; previous downloads and object URLs survive navigation.
6.  Deployment: frozen backend image excludes frontend -> public service -> CDN config points to backend with CORS -> provider-specific streaming and cold-start validation. No deployment or live service was accessed during this review.

Security positives: arbitrary user URLs are not fetched directly, generic extraction is disabled, audio selection is checked against filtered metadata, and filenames are percent-encoded. Remote titles reach DOM textContent/download properties rather than HTML interpolation. CORS is browser policy, not an access or spending control. Upstream redirects and yt-dlp behavior remain dependency trust boundaries; this review did not demonstrate SSRF.

## Prioritized findings

Priority reflects impact and plausibility in this small public media tool. “Confirmed” means code or a focused probe establishes the failure under the stated trigger; it does not mean production incidence was measured. Effort S is a localized change, M spans a lifecycle or integration; these are relative estimates, not schedules.

| Rank | Finding | Impact / likelihood | Effort / change risk | Dependencies |
| --- | --- | --- | --- | --- |
| 1, P1 | F1 Playback activation can leave permanent silence or the wrong active state | Core comparison fails; high for unsupported MSE, interrupted transfers or buffering | M / medium | Tests introduced with step 1; lifecycle ownership F2 |
| 2, P1 | F2 Failed or stale asynchronous work cannot safely recover | One transient failure disables a video; old video audio can replace current audio; high under network delay | S-M / low-medium | None |
| 3, P1 | F3 Manual ranges do not validate what upstream returned | Duplicated/missing bytes, broken downloads; conditional on upstream behavior | M / medium | Fault-injection tests |
| 4, P1 | F4 Image omits YouTube challenge support dependencies | Formats/extraction may fail despite passing mocks; high enough to gate provider validation | S-M / medium | Network/container verification environment |
| 5, P1 before public/cookie rollout | F5 Public proxy and shared credentials lack explicit operating limits | Saturation, uncontrolled transfer costs, possible account-authorized content exposure; traffic/credential dependent | M / medium | Define public-content policy; F6 for cookie mode |
| 6, P1 when cookies enabled | F6 Cookie-file lifecycle conflicts with mounted secrets | Cookie-enabled requests fail on read-only mounts; shared writable file races; conditional but direct | S-M / medium | F5 policy |
| 7, P2 | F7 Browser cache and MediaSource resources never expire | Memory grows with videos/formats; old requests waste bandwidth; certain retention, crash threshold unknown | M / medium | F1/F2 ownership |
| 8, P2 | F8 Backend format metadata is discarded | Available tracks hidden and nominal labels/codec choices used instead of actual values; confirmed contract mismatch, prevalence unmeasured | S-M / low-medium | F1 playback capability handling |
| 9, P2 enabling work | F9 Verification and documentation miss the critical behavior | Failures survive green parser/mocked tests; confirmed coverage and documentation gaps | S-M / low | Add checks with each fix; final documentation pass |

### F1. Activation is recorded before replacement audio can play

[frontend/app.js](https://gogo.crane-boa.ts.net:8449/t/frontend/app.js):122-157,166-172,198, symbols maybeSwitch, attachTrack, syncAudio.

With an incomplete track and no supported MediaSource, maybeSwitch sets activeFormat and mutes the iframe. attachTrack returns without setting audio.src or a completion callback. Completion cannot recover because maybeSwitch returns when the same format is already active. A Node VM executing the repository functions reproduced muted=true and src="" both before and after completion. Switching from another track may instead leave that old source playing under the new active label.

Related confirmed gaps: fetchTrack failure deletes the track without resetting activeFormat or unmuting at :114-116, so a retry of that format can remain unattached; readiness uses byte fraction rather than decoded time ranges; play() rejection is swallowed; addSourceBuffer and asynchronous SourceBuffer errors lack recovery. Browsers can accept a MIME type yet fail buffer creation or decoding. [MSE specification](https://w3c.github.io/media-source/#dom-mediasource-istypesupported).

syncAudio also never sets playbackRate, volume or a user mute policy. At non-1x iframe speed the replacement stays at its default speed and repeated seeks compensate for drift. Actual audible behavior and codec compatibility need browser tests, not VM claims.

### F2. Asynchronous state belongs to a video but can mutate the global player

[frontend/app.js](https://gogo.crane-boa.ts.net:8449/t/frontend/app.js):24-43,67-89, especially pick and loadFormats.

The rejected v.loading promise is never cleared. Two clicks after a simulated transient list failure made only one network call; revisiting that cached video also retains failure. After awaiting metadata, pick does not check v === video, and maybeSwitch has no such guard. A deferred selection for an old video with a cached track attached blob:old while currentVideo was new in the VM probe. Rapid submissions also can call loadVideoById before the first player has finished initialization. That latter race is a source-based risk requiring an iframe readiness test.

### F3. Range advancement assumes the requested bytes arrived

[backend/app.py](https://gogo.crane-boa.ts.net:8449/t/backend/app.py):77-94,127-137, read\_chunks and audio; [backend/tests/test\_app.py](https://gogo.crane-boa.ts.net:8449/t/backend/tests/test_app.py):78-98.

The code reads each upstream response to EOF without checking status, Content-Range or byte count, then advances by the requested range. AST-isolated execution of the unmodified function with fake upstream responses produced:

-   For five bytes and chunk size two, a server ignoring Range yielded abcdeabcdeabcde.
-   A one-byte response to each range yielded ace instead of abcde.

The production HTTP server may abort when this disagrees with the declared Content-Length; this is still a failed transfer, not proof that every client saves corrupt data. [RFC 9110 section 14.2](https://www.rfc-editor.org/rfc/rfc9110.html#name-range) permits a server to ignore Range.

Opening the upstream happens inside the response generator; failures there are outside video\_info's DownloadError mapping. Initial upstream failure can therefore occur after success headers; later failure cannot become a JSON error. Client completion overwrites the expected length with bytes received at frontend/app.js:110-112. The real HTTP framing may detect truncation, but the application has no independent completeness check or documented partial-stream contract.

### F4. Frozen image lacks the pinned extractor's challenge components

[backend/pyproject.toml](https://gogo.crane-boa.ts.net:8449/t/backend/pyproject.toml):6; [backend/uv.lock](https://gogo.crane-boa.ts.net:8449/t/backend/uv.lock):355-361; [backend/Dockerfile](https://gogo.crane-boa.ts.net:8449/t/backend/Dockerfile):1-6; [backend/app.py](https://gogo.crane-boa.ts.net:8449/t/backend/app.py):39-49.

Bare yt-dlp installs no optional dependencies; the lock has no yt-dlp-ejs and the Dockerfile installs no JavaScript runtime. The pinned release's [README](https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.08.19/README.md) requires EJS plus a supported runtime for full YouTube support; its [dependency declaration](https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.08.19/pyproject.toml) places EJS in an optional extra. The missing EJS component is confirmed; whether a particular video needs it and what the base image happens to contain require image inspection and live extraction. Warnings are suppressed, making reduced support harder to diagnose. This is a deployment risk, not a claim that every video currently fails. ffmpeg is not required merely to proxy the selected existing audio files.

### F5. Resource and account boundaries are implicit

[backend/app.py](https://gogo.crane-boa.ts.net:8449/t/backend/app.py):39-54,77-94,97-137; [README.md](https://gogo.crane-boa.ts.net:8449/t/README.md):91-100; [docs/tasks/1-scaleway-deployment.md](https://gogo.crane-boa.ts.net:8449/t/docs/tasks/1-scaleway-deployment.md):46-54.

Anyone reaching the public API can trigger extraction and long upstream transfers. There is no application admission limit, track-size/duration policy or overall operation deadline. yt-dlp/framework defaults may supply some network/thread limits, but they are not an explicit service budget or deployment contract. Cloud Run instructions do not bound instances; the Scaleway plan already proposes bounded scale and explicit concurrency. External controls may exist but none were verified.

When YTDLP\_COOKIEFILE is configured, all callers use the same account authority. If that account can access content unavailable anonymously, the API has no caller authorization check to distinguish it. This is a conditional confidentiality risk, not evidence of an exposed account or private video. Keep public use deliberate; do not introduce an account system unless the product actually requires authenticated content.

### F6. yt-dlp writes the configured cookie file on close

[backend/app.py](https://gogo.crane-boa.ts.net:8449/t/backend/app.py):47-54,82; [README.md](https://gogo.crane-boa.ts.net:8449/t/README.md):97-100,120-123; [docs/tasks/1-scaleway-deployment.md](https://gogo.crane-boa.ts.net:8449/t/docs/tasks/1-scaleway-deployment.md):54.

Both extraction and streaming create context-managed YoutubeDL instances against the same cookiefile. The pinned upstream [YoutubeDL.close/save\_cookies](https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.08.19/yt_dlp/YoutubeDL.py) saves it; [YoutubeDLCookieJar.save](https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.08.19/yt_dlp/cookies.py) opens it for writing. A read-only secret mount is incompatible with that lifecycle; permission errors are not caught by video\_info's DownloadError handler. A shared writable file permits concurrent writers. This is established from pinned source, not a live credential test. No real cookies were read.

### F7. Cache retention is unbounded and detachment is incomplete

[frontend/app.js](https://gogo.crane-boa.ts.net:8449/t/frontend/app.js):7,39,95-113,140-163.

Every visited video, raw chunk array and completed Blob URL remains reachable. Object URLs are never revoked. Switching away leaves old fetches and MediaSource append callbacks alive. Memory retained by chunk arrays alone grows with total fetched bytes; Blob/MSE backing-store duplication is browser-specific and was not measured. A long comparison session on a constrained device can exhaust memory. No persistent browser storage is necessary to solve this.

### F8. The frontend ignores the actual format contract

[frontend/providers.js](https://gogo.crane-boa.ts.net:8449/t/frontend/providers.js):7-19; [frontend/app.js](https://gogo.crane-boa.ts.net:8449/t/frontend/app.js):13,67-72,94-112,194; [backend/app.py](https://gogo.crane-boa.ts.net:8449/t/backend/app.py):57-74,116-124.

The server returns format\_id, ext, acodec, abr, size and MIME, but the client saves only IDs and uses the static table for rendering, decoding and filenames. An otherwise supported audio format absent from those ten IDs is inaccessible. The backend fixture itself uses 129 kbps for ID 140 while the client labels/downloads it as 128. Nominal bitrate can be a valid initial estimate, but it must be identified as such. Distinct language/variant IDs require fixtures before claiming a production failure. The API already excludes HLS/DASH; “all audio formats” in README overstates the supported subset.

### F9. Tests and docs describe more assurance than they provide

[frontend/tests/providers.test.js](https://gogo.crane-boa.ts.net:8449/t/frontend/tests/providers.test.js):8-33 never imports app.js. Backend tests replace extraction and test ideal ranges; none cover real codec bytes, HTTP fault framing, cookies or container extraction. No CI is checked in.

[README.md](https://gogo.crane-boa.ts.net:8449/t/README.md):79-84 mixes backend working directory, a blocking server command and a frontend test command that fails here even from root. :44-47 suggests provider fallback, but parsers reject unrecognized input. :58 omits backend validation; :65 implies progress requests even though :132 and code use received bytes. :33-40 does not describe fallback/readiness limits. :70-73 has no route parameters, response fields, errors or stream failure contract.

[docs/tasks/1-scaleway-deployment.md](https://gogo.crane-boa.ts.net:8449/t/docs/tasks/1-scaleway-deployment.md):80 cites an external repository's checker path despite the local tool; :83-94 correctly records historical incomplete tests/runtime checks. Preserve those dated results rather than converting them to new passes. “Cloud Run fallback” is a plan; frontend/config.js:3 is empty and does not establish a deployed endpoint.

## Ordered remediation

Execute only after separate implementation authorization. Introduce regression checks with the changes they protect; do not postpone all testing until the end.

### 1\. Fix request ownership and retry recovery, F2 and the retry portion of F1

Changes: frontend/app.js pick/loadFormats/showVideo/fetchTrack/stopAudio. Clear failed metadata promises, retain successful deduplication, serialize player readiness, and check the current selection after every await before touching shared playback or errors. Tie activation to a specific video and track instance. Restore original sound and clear active state when the active transfer fails.

Prerequisites: none. This is first because it is localized, restores retry immediately and defines ownership needed for later cleanup.

Acceptance/verification: a failed first list request can succeed on the next click; concurrent successful clicks share one list request; a delayed old-video response cannot change current audio/errors; first-player rapid submissions settle on the latest video; same-format transfer retry can play. Add deterministic deferred-promise/failure tests using minimal DOM/player fakes, keeping the test seam small. Update README to explain retry behavior.

Migration/rollback: none; static asset rollback and page reload reset tab state. Preserve old asset set for rollback.

### 2\. Make playback switching conditional on usable audio, F1

Changes: maybeSwitch, attachTrack, syncAudio and their cleanup. Preserve original video sound until a replacement is attached, decoded and covers the requested time. For unsupported MSE, explicitly wait for completed Blob playback. Handle addSourceBuffer, asynchronous buffer/media errors, autoplay rejection and download failure with visible recovery. Use actual buffered ranges for incremental playback; byte counts remain download progress only. Synchronize playback rate and define user mute/volume behavior. Ensure obsolete callbacks cannot reattach a retired track.

Prerequisites: step 1. Benefit: comparison remains audible and the active indicator represents the track actually playing.

Acceptance/verification: supported and unsupported MSE; missing content length; delayed sourceopen; decoding/append failure; failed audio.play; pause/resume; forward/back seek beyond buffer; non-1x speed; switching during transfer and after completion. Use deterministic lifecycle tests plus short real AAC/Opus fixture playback in supported target browsers. Document tested browser/format combinations and download-only fallback. Do not claim seamless playback until observed.

Migration/rollback: no data migration. Keep completed-Blob playback as a conservative fallback if incremental behavior is not reliable; revert static assets if necessary.

### 3\. Validate stream integrity and define failure behavior, F3

Changes: backend/app.py read\_chunks/audio and backend tests; frontend fetchTrack completion/error handling. Validate ranged status, Content-Range and actual byte counts; correctly handle a full response when ranges are ignored; never advance over missing bytes. Bound retries and resume only from verified offsets, or fail clearly. Establish upstream readiness before committing success headers where practical; after response start, close failed streams and log a sanitized reason. Compare received bytes with a known expected length before enabling download.

Prerequisites: fault-injection fixtures; step 1 provides client recovery. Benefit: downloaded files and streamed playback have a defensible completeness contract.

Acceptance/verification: correct 206; ignored-range 200; wrong range start; short/oversized response; 403/416; exception before first byte and midstream; unknown size; client disconnect. Assert exact final bytes or explicit failure, never silent duplication/skips. Test real Uvicorn HTTP framing in addition to in-process TestClient. Ensure network handles close and deadlines release capacity. Document that client resume/Range support is not currently promised.

Migration/rollback: keep current endpoint/query shapes. No stored data migration. Revert backend image independently; disable a problematic range strategy rather than accept invalid bytes.

### 4\. Establish a reproducible YouTube-capable image, F4 and build aspects of F9

Changes: backend/pyproject.toml, uv.lock, Dockerfile, ydl\_opts diagnostics, README deployment procedure. Install the smallest pinned EJS/runtime set supported by the chosen yt-dlp release and configure runtime discovery explicitly if needed. Preserve frozen installs. Record image digest and runtime versions; expose useful sanitized extractor warnings in operational logs. Add a small CI workflow that runs current suites, tracker check and image startup checks, then extend it with prior steps' regression tests.

Prerequisites: dependency access and functioning container runtime. This review environment lacks both a successful dependency download and Docker. Benefit: failures due to packaging are separated from provider-IP blocks before more deployment attempts.

Acceptance/verification: frozen clean build on Python 3.12; installed EJS/runtime detected; startup on default and custom PORT; production image excludes dev tests and credentials; representative public YouTube format extraction and full audio transfer from the candidate provider. Record cold/warm timings and warnings. Keep routine CI deterministic; make live provider checks a separately recorded release gate.

Migration/rollback: retain last working image digest and matching lockfile. No database migration. Revert image and dependencies together.

### 5\. Define bounded public service and safe cookie handling, F5/F6

Changes: backend admission/deadline/size controls, ydl\_opts and cookie ownership, README configuration/security/operations, existing Scaleway settings document. Set explicit max instances, request concurrency and application resource limits appropriate to measured stream costs. Make overload visible and retryable. Define supported media size/duration and unknown-size handling; bound active work after disconnect. Start with provider/app controls, not a distributed queue.

Treat mounted cookies as immutable input. If cookies are needed, load a private per-operation jar or a securely permissioned temporary copy with deterministic cleanup so yt-dlp never writes the secret mount or shares a mutable file across requests. Explicitly decide whether the public API may serve account-authorized content; use anonymous operation when that boundary is not intended. Avoid raw upstream error strings containing sensitive URLs/account context in public responses; retain sanitized diagnostics.

Prerequisites: F5 policy decision before enabling credentials; steps 3/4 before public validation. Benefit: protects service capacity and optional account authority.

Acceptance/verification: overload refuses work before extraction; blocked/slow upstream reaches a defined deadline; disconnect frees resources; oversized and unknown-size streams obey policy; allowed/disallowed CORS origins behave as documented without being mistaken for authentication. A read-only synthetic cookie fixture succeeds without modifying it; concurrent requests cannot overwrite each other's jars; files disappear after success/failure; responses/logs exclude secret values. No production credentials in CI.

Migration/rollback: optional configuration rollout with measured conservative defaults. Roll back settings/image if legitimate requests are rejected; disable cookie mode independently. No persistent data migration.

### 6\. Bound browser retention, F7

Changes: app.js cache/fetch/MSE ownership, optionally one small lifecycle module if tests benefit. Define a configurable byte/video budget; evict inactive tracks or provide explicit clear-cache behavior. Abort unwanted requests, detach callbacks/buffers, revoke retired MediaSource and Blob URLs, release redundant chunk references after completion when safe. Keep active playback/download URLs alive.

Prerequisites: steps 1/2. Benefit: comparison sessions stop accumulating all downloaded media indefinitely.

Acceptance/verification: switch through more videos than the chosen cap and verify application-owned byte counts remain bounded; evicted tracks refetch; active/download URLs remain valid; stale source callbacks cannot change audio; abort cleans up both success and error paths. Supplement object-ownership assertions with browser memory observation, without demanding a specific garbage-collector timing.

Migration/rollback: tab-only cache; reload clears it. Document eviction so “fetch once” means once while retained. Roll back policy independently of cleanup.

### 7\. Use actual format metadata, F8

Changes: loadFormats/renderColumn/pick/fetchTrack/download names in app.js, providers.js initial catalog, and API metadata only where a fixture proves a missing field. Keep speculative initial columns, then merge authoritative supported formats from the backend. Display actual codec/container/bitrate or mark estimates/unknown values. Render previously unknown supported IDs; distinguish unavailable media from browser playback limitations. Avoid guessing language or conflating variants.

Prerequisites: step 2 for capability fallback. Benefit: the comparison and saved filename describe the selected media and do not hide supported tracks.

Acceptance/verification: known format with changed bitrate, unknown format ID, absent bitrate/size, no supported formats, and captured multilingual/variant fixtures. Download name and playback MIME use the same selected metadata. Preserve backend audio-only/protocol allowlist. Correct README's “all formats” claim and describe YouTube-only support.

Migration/rollback: prefer additive response changes and maintain old keys. Deploy compatible backend first if adding fields; then static assets. No stored data migration.

### 8\. Consolidate documentation and strengthen the existing deployment gate, F9 and remaining F4/F5 validation

Changes: README local commands, actual architecture/API contract, browser fallback/cache behavior, operating limits, cookie handling, release checks and rollback. Keep design decisions near those sections rather than creating a new architecture-document hierarchy. Update only the relevant sections of docs/tasks/1-scaleway-deployment.md when authorized, linking this review's prerequisites without replacing its historical results.

Prerequisites: document actual outcomes of steps 1-7. Benefit: provider migration tests the fixed product and a repeatable build, not only a container that starts.

Acceptance/verification: run documented commands from their stated directories. Use `node --test frontend/tests/*.test.js` from root, with a declared tested Node version, and a separate backend/server terminal sequence. Run all 22 existing backend cases plus added tests, all frontend checks, `python3 tools/check_tasks_md.py TASKS.md`, and image checks. Document /api/formats and /api/audio parameters, fields, supported protocols, errors and partial-stream behavior; link FastAPI's generated docs where useful.

For the existing Scaleway task, retain the organization/CLI prerequisites and Cloud Run fallback. Record image digest, public extraction, exact full transfer, progressive browser playback, cross-origin behavior, cold/warm results, bounded concurrency and cookie mode if used. Do not switch frontend/config.js until those gates pass and a known fallback endpoint/config snapshot is recorded. The current provider limit permits a 900-second request timeout, but provider limits do not prove stream success. [Scaleway limits](https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-limitations/).

Migration/rollback: documentation-only until separately authorized deployment. A later service switch changes API-base configuration with retained prior CDN assets/config and backend image. No service was deployed or switched by this review.

## Existing backlog reconciliation

-   TASKS.md:13-14 and docs/tasks/1-scaleway-deployment.md already own the Scaleway deployment and remote validation. Steps 4/5/8 strengthen its prerequisites and gates; do not create another provider-migration plan or task.
-   TASKS.md:18-22 marks the comma retry, CLI fallback and Dockerfile work complete. The task document explicitly distinguishes completed attempts from blocked deployment at :34-36. That is consistent; do not reopen or rewrite those bullets as if deployment had succeeded or their historical work never happened.
-   The completed filename item at TASKS.md:23 is implemented by backend download\_filename and frontend download naming. F8 concerns the accuracy of the client bitrate metadata, not absence of the completed filename feature.
-   No existing repository backlog item explicitly tracks F1-F3 or F5-F8. They remain findings in this task plan; no tracker bullets or task documents were added.
-   The external checker path at docs/tasks/1-scaleway-deployment.md:80 is a documentation portability issue. Use the local tool for future checks and preserve the historical attempt.
-   TASKS.md's exact-text, one-heading rule remains untouched. Its checker passed. The checker detects repeated normalized text across headings, not issue identity, missing links or dependency validity; do not mistake it for validation of all tracker rules.

## Lower-priority observations

-   Malformed URL authorities can raise ValueError from urlparse before video\_info's error mapping, backend/app.py:27,106-113. The isolated parser probe reproduced “Invalid IPv6 URL”. Add malformed-input parity tests and return 400; this is a small boundary fix, not demonstrated SSRF.
-   frontend/index.html:16 relies on a placeholder instead of an explicit input label; active format is only visual in app.js:186/style.css:15,22. Add a label and accessible selected/loading state alongside the UI work; verify keyboard and screen-reader operation.
-   iframe script/player errors have no visible recovery at app.js:17-30. Handle load failure and embedding errors in the player lifecycle tests.
-   Rendering queries every column on each chunk and every 250 ms, app.js:108,179-198. With ten columns this is not a demonstrated bottleneck. Profile before changing it.
-   Mutable base-image tagging and shell-based startup in Dockerfile:1,6 make image reproducibility and signal behavior worth a startup/shutdown check. Digest tracking and direct signal forwarding can be small follow-ups; no orchestrator rewrite is justified.
-   yt-dlp filesystem cache and cookie writes qualify README's stateless claim. Durable volumes still are not required for the application; document ephemeral state rather than introducing persistence.
-   Keep duplicated frontend/backend URL validation because each serves a trust boundary; shared fixtures can prevent drift without introducing a cross-language schema generator.
-   The tracker checker has no tests and identifies normalized bullet text rather than numbered identity. Only strengthen it as separate authorized tracker work if actual maintenance needs justify it.

## Verification record and limitations

Completed checks:

-   Full tracked-file inventory and source/document inspection; three Python files parse successfully; lockfile TOML parses.
-   Node v24.19.0: documented `node --test frontend/tests/` fails with MODULE\_NOT\_FOUND. Explicit file glob succeeds, reported by this environment as one file-level test. Direct `node frontend/tests/providers.test.js` runs all three named tests and passes.
-   `python3 tools/check_tasks_md.py TASKS.md` passes.
-   Node VM executing repository functions with fake DOM/player/network reproduces unsupported-MSE silence, a poisoned retry promise and stale-video selection.
-   AST-isolated original Python functions with fake upstream IO reproduce ignored-range duplication, short-range byte skipping and malformed-URL exception.

Not completed:

-   Backend pytest execution: offline temporary environment lacked cached wheels; normal frozen installation retried and failed DNS resolution for files.pythonhosted.org. Source contains 22 parametrized cases; none is claimed as passing in this review.
-   No browser media decoding, real iframe interaction, container build/run, live YouTube extraction, actual cloud configuration, credentials, throughput/load or production incident measurements. Docker was unavailable. VM/AST probes establish control-flow defects but do not establish real codec or HTTP-server behavior.
-   Locked upstream source and primary protocol/provider documentation were checked for the EJS, cookie-write, MSE and Range findings. This is not a full dependency vulnerability audit or a claim that all current provider assumptions were verified.
-   Earlier tracker maintenance was not altered. Review is a snapshot of this commit; later concurrent changes require rechecking the affected evidence.

Recommended first work: fix retry/current-video ownership, then make activation wait for playable audio. Validate stream bytes next. Gate the already-planned provider migration on a YouTube-capable image, safe cookie handling, explicit resource limits and the expanded end-to-end checks.
