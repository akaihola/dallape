# Architecture recheck, 2026-10-21

Checked local `main` at **`b3aa994722c6f3fae3436ad26bb4b2fa80e319b7`**,
the HAI-12 start commit. The [original architecture review] names
`7abab234f562d2ea8a89728ceff69dd58a940318` as its code snapshot;
`cc5b161` added that review and is the requested comparison anchor.
This recheck covers the 53 commits from `cc5b161` through the checked commit,
including the later remediation and acceptance records. It describes source
behavior, not the version currently deployed.

Four original ranked findings are resolved, four changed, and one remains open.
One new P1 finding warrants a draft: playback failure before EOF destroys an
otherwise usable download. The remaining original work already has open issues.

## Scope and method

Re-read every original finding's implementation and the changed application,
deployment, configuration, fixtures and test code. Read the remediation evidence
and [tracker] to distinguish accepted fixes from open proposals. Status means:
**resolved** for the original demonstrated defect; **changed** for partial
remediation with remaining work; **open** for a surviving original defect.
Resolution is not a claim of universal browser compatibility or production
verification. Original ranks below remain identifiers; the final ordering reflects
today's remaining work.

Applied the installed [Honey skill]: keep the existing static client and small
streaming backend, reuse the current test seam, and require a demonstrated need
before adding an abstraction. No installed `codebase-design` skill was found in
the local agent skill directories or cached plugin skills, including followed
symlinks. Its prescribed workflow could not be applied. The design assessment
uses the requested deep-module vocabulary explicitly: a small interface should
hide substantial lifecycle policy; line count alone does not justify splitting
a module.

## Earlier ranked findings

- **F1 — Changed; original rank 1, P1.** Activation now waits for decoded
  buffered timestamps, readiness and successful playback; unsupported MSE waits
  for a completed Blob. Rate, volume, captured mute state and restoration on
  pause/seek/failure are implemented in [frontend/app.js, lines 285–425][app].
  `f2e324a` and `ff70f38` deliver [request ownership and retries][hai4] (HAI-4)
  and [playable audio activation][hai5] (HAI-5). Both are accepted. The original
  mute-before-attachment defect is gone, but recovery still couples playback
  failure to transfer destruction: **N1** below. The recorded AAC MSE failure
  with completed-Blob recovery is historical evidence, not a fresh browser run.

- **F2 — Resolved; original rank 2, P1.** `f2e324a` adds shared player readiness,
  submission ownership, failed-metadata promise clearing and attachment guards;
  `97e9147` adds cancellation. [frontend/app.js, lines 32–139, 163–208 and
  238–282][app] checks ownership after asynchronous boundaries and ignores
  retired transfers. [frontend/tests/app.test.js, lines 107–237 and 250–285][app-tests]
  exercises deferred success/failure, navigation back to the same video,
  rapid first submissions, retired callbacks and same-format retries.
  [Request ownership and retries][hai4] (HAI-4) is accepted; no duplicate draft.

- **F3 — Resolved; original rank 3, P1.** `6203e6b` checks status, encoding,
  Content-Range, declared length and received bytes; it holds the last block
  until EOF validation and advances only by verified bytes. Ignored ranges fail
  explicitly, with no retry. Preflight precedes success headers; later failures
  abort framing and close upstream handles. See [backend/app.py, lines 95–177
  and 216–232][backend] and [frontend/app.js, lines 243–282][app]. The actual
  Uvicorn framing and disconnect cases in [backend/tests/test_stream.py,
  lines 119–258][stream-tests] pass in this recheck. [Stream integrity and
  recovery][hai6] (HAI-6) is accepted. The documented lack of a hard wall-clock
  deadline for a continuously trickling blocking read belongs to F5, not a
  reopened range-integrity defect.

- **F4 — Changed; original rank 4, P1.** The frozen same-origin image recipe
  (`11da77e`), recorded provider extraction/transfer (`db6feca`), and image smoke
  evidence (`546d85a`) narrow the original deployment concern. However,
  [backend/pyproject.toml, lines 1–9][manifest] and [backend/uv.lock,
  lines 355–361][lock] are unchanged from `cc5b161`: the lock contains yt-dlp
  `2026.8.19` and no EJS package. [deploy/Dockerfile, lines 3–10][dockerfile]
  declares no challenge-runtime installation; [backend/app.py, lines 50–60][backend]
  still suppresses warnings. No checked-in CI or release runtime/digest inventory
  establishes challenge-capable reproducibility. This does not claim that every
  extraction fails, or re-audit today's upstream requirements. Open owner:
  [reproducible YouTube-capable release image][hai7] (HAI-7).

- **F5 — Changed; original rank 5, P1 for public use.** `6203e6b` adds a
  10-second stream socket timeout, an 840-second budget checked between reads,
  cleanup and generic public extraction/stream errors. See [backend/app.py,
  lines 23–24, 95–177 and 189–232][backend]. Extraction itself still has no
  application admission, total-operation deadline or media size/duration policy;
  stream timeouts do not cover its earlier work. Anonymous callers can initiate
  extraction and streaming. [The deployment record, lines 82–85][deployment]
  records max-scale 2, concurrency autoscaling threshold 20 and provider timeout
  900 seconds; those are historical provider settings, not application admission
  limits. Cookie-enabled calls still inherit shared account authority. Open owner:
  [public audio limits and cookie policy][hai8] (HAI-8); no duplicate draft.

- **F6 — Open; original rank 6, P1 when cookies are enabled.**
  [backend/app.py, lines 50–65 and 103][backend] still supplies the same
  `YTDLP_COOKIEFILE` to context-managed extraction and streaming. No immutable
  input copy, isolated mutable jar or synthetic cookie lifecycle test was added.
  The unchanged lock preserves the basis of the original pinned-source finding
  about yt-dlp saving cookies on close; this recheck did not read real cookies
  or test an account. Anonymous deployment does not resolve the advertised
  optional mode. Open owner: [public audio limits and cookie policy][hai8]
  (HAI-8), which already permits removing unsupported cookie mode instead of
  building credential management.

- **F7 — Resolved; original rank 7, P2.** `97e9147` implements configurable
  video/byte budgets, LRU eviction, request aborts, reader cleanup, chunk release,
  callback/buffer detachment and URL revocation. See [frontend/app.js,
  lines 9–12, 107–128, 212–282 and 318–379][app] and [frontend/config.js,
  lines 5–7][config]. The default 192 MiB reserve accounts for three encoded
  copies, admitting at most 64 MiB of retained audio; it is not a browser process
  memory cap. [Browser retention and cleanup][hai9] (HAI-9) is accepted and
  records both bounded ownership and growing browser memory counters without
  claiming GC timing. [frontend/tests/app.test.js, lines 491–597][app-tests]
  passes eviction, refetch, late EOF, cancellation, active URL and rollback cases.

- **F8 — Resolved; original rank 8, P2.** `bade6f2` retains authoritative
  metadata, renders unknown IDs, labels estimates/unknowns, and uses selected
  MIME and filename fields. See [frontend/app.js, lines 163–174, 203–204,
  270 and 431–466][app] and [backend/app.py, lines 68–88][backend]. The
  captured multilingual fixture and synthetic missing-field/changed-bitrate
  cases cover the original contract mismatch. [Backend format metadata][hai10]
  (HAI-10) is accepted. N1 concerns download survival after a playback error,
  not loss of the format metadata repaired here.

- **F9 — Changed; original rank 9, P2.** Lifecycle tests, real Uvicorn framing,
  generated-media browser checks, metadata fixtures and substantial API/cache
  documentation now exist (`f2e324a`, `6203e6b`, `ff70f38`, `bade6f2`, `97e9147`).
  Current deterministic suites pass. Remaining gaps: no CI; no fresh release
  image/live cold-start evidence; and no controlled progressive-transfer browser
  case for N1. [tools/check_audio_browser.mjs, lines 32–75][browser-check]
  enables autoplay, substitutes the iframe clock and supplies a whole fixture
  through `route.fulfill`; it does not intentionally hold EOF after a playable
  first segment. [README.md, lines 118–125 and 138–143][readme] still omits
  backend validation from its responsibilities table, describes nonexistent
  progress requests, and mixes working directories with a blocking server
  command. Open owners: [release image verification][hai7] (HAI-7) for CI/build,
  [public audio limits and cookie policy][hai8] (HAI-8) for operational tests,
  and [contracts and the existing release gate][hai11] (HAI-11) for consolidation.

## Earlier lower-priority observations

- **Malformed authorities — Resolved.** `6203e6b` catches parser/port failures
  and rejects credentials and unsupported authorities. [backend/app.py,
  lines 27–47][backend], [backend/tests/test_app.py, lines 119–131][backend-tests]
  and [frontend/tests/providers.test.js, lines 38–49][provider-tests] provide
  the independent boundary checks owned by accepted [stream integrity][hai6].
- **Accessible selection — Resolved in implementation.** `ff70f38` adds the
  explicit label, status output and pressed/busy/playing state in
  [frontend/index.html, lines 15–20][html] and [frontend/app.js, lines 450–462][app].
  [Playable activation][hai5] records keyboard and accessibility snapshot
  checks, not a human screen-reader listening session.
- **Iframe failures — Resolved.** `f2e324a` adds visible errors, timeouts,
  mount recreation and retry guards in [frontend/app.js, lines 32–104][app],
  with [frontend/tests/app.test.js, lines 147–171 and 250–270][app-tests].
- **Rendering cost — Open as a measurement question.** [frontend/app.js,
  lines 263, 431–480][app] still renders on chunks and a 250 ms timer.
  Unknown-format columns increase the possible count, but no measured bottleneck
  justifies a performance issue or new rendering layer.
- **Mutable image/startup shell — Open.** [deploy/Dockerfile, lines 3 and 10][dockerfile]
  retains both. [Release image verification][hai7] already owns digest tracking
  and shutdown/signal checks.
- **Ephemeral extractor state — Open.** [backend/app.py, lines 50–65][backend]
  does not establish a no-cache/no-cookie-write contract, while [README.md,
  lines 149–152][readme] still says the container keeps no state. [Public audio
  limits and cookie policy][hai8] and [contract documentation][hai11] own this;
  it does not call for durable storage.
- **Independent URL validation — Resolved before the original review.**
  Original commits `8d5025d` and `2cfb219` established the two boundaries;
  `6203e6b` adds malformed-authority parity fixtures. Keep both parsers;
  no schema generator is justified.
- **Tracker checker semantics — Open, deferred.** [tools/check_tasks_md.py,
  lines 17–68][tracker-check] is unchanged, compares normalized bullet text
  across headings and has no dedicated tests. This audit found no concrete
  maintenance failure requiring a new issue. Passing it is not proof of every
  tracker identity/dependency rule.

## New findings

- **N1 — P1, first remaining product fix.** A playback error before EOF
  prevents download and repeats on retry. Impact: a supported format becomes
  unobtainable through the UI when its MSE path fails early. Likelihood:
  conditional on failure timing; the control flow is confirmed, production
  frequency unmeasured. Effort S–M; change risk medium because cancellation and
  cache ownership must survive. No unmet prerequisite among accepted fixes.

  [frontend/app.js, lines 297–304][app] calls `retireTrack` for any playback
  failure while `track.done` is false. [Lines 212–221][app] delete the track,
  abort its request, cancel the reader and clear bytes. The next click refetches
  and retries MSE through [lines 203–207 and 285–294][app]; it retains no memory
  of the failed playback path. Repeating an early decoder/buffer failure can
  therefore never reach the completed-Blob fallback or download link. This
  contradicts [README.md, lines 103–107][readme]. Completed-file error recovery
  works, but does not help this case.

  The behavior was introduced with playback error disposal in `f2e324a` and
  remains after `ff70f38` and `97e9147`. A temporary probe reused the unmodified
  `setup` helper from [frontend/tests/app.test.js, lines 7–105][app-tests]. It
  supplied five of ten promised bytes, then separately injected source-buffer
  creation failure, buffer error, media error and rejected `play()`. All four
  left the original unmuted but aborted the transfer, retained zero tracks and
  hid the download. After resetting the fake decoder readiness and retrying,
  each started a second audio request and a second MSE attachment. Existing
  [error tests, lines 218–237][app-tests] expect refetch; they do not test a
  successful download after an early decode failure.

  The design defect is shared failure ownership: playback owns a temporary
  attachment, but its failure destroys the independently useful transfer.
  Keep that distinction inside the current module. A playback failure should
  detach/restore sound and permit a bounded download to finish, with completed
  Blob retry where supported. Transfer corruption, budget overflow and explicit
  retirement must still cancel and discard. No new lifecycle framework is needed.

## Design assessment of the added code

The added volume mostly implements real failure handling and regression cases.
`startApp` provides a deep boundary: one browser dependency seam and a small
ownership diagnostic hide request, playback and cache policy. Splitting
[frontend/app.js][app] solely because it grew from 198 to 484 lines would expose
shared state without fixing N1. Correct the transfer/attachment ownership within
that boundary first.

`read_chunks` hides upstream status/range/length validation behind an iterator;
`AudioResponse` owns consumption and close-on-disconnect in [backend/app.py,
lines 95–177][backend]. These helpers earn their interfaces. The per-read thread
handoff is necessary to keep blocking upstream reads off the event loop; the
remaining total-work policy is already F5's responsibility.

The single image, health route and [loading Worker][worker] from `11da77e`
remove a deployment boundary and keep the loading response policy in one small
handler. No additional abstraction or new ranked defect was established in the
Worker, static mount, allowlist, metadata projection or build-context changes.
Its real cold-start behavior remains unverified under the existing release gate.
The six-row [metadata fixture][fixture] preserves useful provider variation
without signed URLs or request headers. Keep the narrow injected test seam and
local browser fixture script; strengthen their timing cases instead of replacing
them with a testing framework.

## Remediation and open-issue reconciliation

Original steps 1, 3, 6 and 7 are resolved through accepted [request ownership][hai4],
[stream integrity][hai6], [browser retention][hai9] and [format metadata][hai10].
Step 2 changed through accepted [playable activation][hai5]; N1 is the newly
identified follow-up. Steps 4, 5 and 8 changed but remain open in [release image
verification][hai7], [public limits and cookie policy][hai8], and [contracts and
the release gate][hai11]. These three are currently **Unverified proposals**,
not accepted or scheduled work.

No duplicate issues are drafted for F4, F5, F6 or remaining F9. The existing
[Scaleway deployment task][deployment] retains live-validation ownership, and
the [tracker] retains the separate scanner WAF issue. Accepted historical work
and its evidence remain intact. No new issues were filed.

## Do these three first

1. Fix **N1**: preserve bounded downloads after early playback failure, with a
   deterministic partial-transfer regression and a paced real-media check.
2. Finish [reproducible release image verification][hai7] (HAI-7): establish the
   chosen extractor/runtime setup, image identity and deterministic CI before
   treating the application fixes as releasable.
3. Finish [public limits and cookie policy][hai8] (HAI-8), following its release
   image prerequisite: explicit admission/deadlines/size policy and a deliberate
   anonymous-or-isolated-cookie decision. Then finish the already-open
   [contract and release gate][hai11] (HAI-11).

**Recommendation:** Keep this order: repair the demonstrated product failure,
then establish a reproducible and bounded release. Defer speculative rendering
and tracker refactors for this tier-3 project.

## Validation and limits

- **Frontend:** Node v24.21.0, `node --test frontend/tests/*.test.js` from the
  repository root: **37 passed, 0 failed**.
- **Backend:** used the existing shared-checkout Python 3.14.7 environment to
  execute this worktree's backend with `PYTHONDONTWRITEBYTECODE=1` and
  `python -m pytest -q -p no:cacheprovider`: **70 passed, 0 failed**. One existing
  Starlette/AnyIO `BlockingPortal` deprecation warning. This is not a fresh
  dependency install or Python 3.12 release-image test.
- **N1 probe:** all four deterministic failure timings reproduced the described
  disposal and refetch behavior. The first probe attempt needed its fake decoder
  readiness reset before the play-rejection retry; the corrected run passed all
  four assertions. No repository test or application file was changed.
- **Document checks:** tracker invariant, diff whitespace, relative link targets,
  original finding coverage and documentation-only scope checked before commit.
- **Memory:** commands used a 2 GiB availability gate with the requested
  ten-minute wait; heavy commands required that gate. Monitored commands every
  200 ms, bounded them to five minutes and stopped on less than 1 GiB available
  or swap growth over 512 MiB. Tests ran one suite at a time. No memory stop
  occurred.
- **Not repeated:** browser/media integration, live iframe or YouTube requests,
  human listening, cloud configuration, image build, cookie credentials, load
  measurements or deployment. Earlier browser/provider results are explicitly
  historical. The original external dependency/protocol claims were not freshly
  audited; their unchanged-source basis and outstanding verification are noted
  above. This task changes only this report and HAI-12's own tracker moves.

## Draft issues

One draft; the steward decides whether to file it. No open issue specifically
owns N1. [Playable activation][hai5], [browser retention][hai9] and
[format metadata][hai10] are accepted. The broader [release gate][hai11] owns
progressive browser evidence, not this newly demonstrated transfer-disposal fix.

- **Title:** Preserve audio downloads after playback fails before EOF.
- **Why:** N1: source-buffer creation, append/decode, media or play failure
  deletes an incomplete track and aborts its valid download. Retrying repeats
  MSE, so early repeatable failures cannot reach a completed Blob or download.
- **What to change:** Separate attachment failure from transfer failure inside
  [frontend/app.js][app]. Restore original sound and detach failed playback;
  keep the current transfer within existing cache limits, suppress repeated
  failing streaming attachment for that attempt, and allow completed-Blob retry
  or download-only use. Keep cancellation on navigation, format retirement,
  integrity failure and budget overflow. Reuse the existing test seam and
  update the fallback contract in [README.md][readme].
- **Acceptance:** With a supported MIME and only part of the response received,
  inject buffer creation, append/asynchronous decode, media and play failures.
  Original audio remains audible; a valid remaining response reaches clean EOF
  and exposes the exact downloadable bytes without another network request.
  An explicit completed-Blob retry plays when that decoder supports it; otherwise
  the file stays downloadable. Repeat with unknown Content-Length and a paced
  real-media response whose EOF is delayed until after playback failure.
  Navigation and cache pressure still release retired resources; malformed or
  truncated transfers never expose downloads. Existing ownership, byte-budget
  and stale-callback regressions pass.

[original architecture review]: ../2026-09-19-architecture-review-and-remediation-plan.md
[tracker]: ../../TASKS.md
[Honey skill]: http://hopeli/.codex/plugins/cache/greenpt/honey/1.4.0/skills/honey/SKILL.md?f
[app]: ../../frontend/app.js
[app-tests]: ../../frontend/tests/app.test.js
[backend]: ../../backend/app.py
[backend-tests]: ../../backend/tests/test_app.py
[stream-tests]: ../../backend/tests/test_stream.py
[provider-tests]: ../../frontend/tests/providers.test.js
[manifest]: ../../backend/pyproject.toml
[lock]: ../../backend/uv.lock
[dockerfile]: ../../deploy/Dockerfile
[config]: ../../frontend/config.js
[html]: ../../frontend/index.html
[readme]: ../../README.md
[browser-check]: ../../tools/check_audio_browser.mjs
[worker]: ../../deploy/cloudflare/worker.js
[fixture]: ../../frontend/tests/fixtures/youtube-multilingual.json
[tracker-check]: ../../tools/check_tasks_md.py
[deployment]: ../tasks/1-scaleway-deployment.md
[hai4]: ../tasks/4-fix-audio-request-ownership-and-retry-recovery.md
[hai5]: ../tasks/5-activate-replacement-audio-only-when-it-can-play.md
[hai6]: ../tasks/6-validate-audio-stream-bytes-and-failure-recovery.md
[hai7]: ../tasks/7-verify-a-reproducible-youtube-capable-release-image.md
[hai8]: ../tasks/8-bound-public-audio-work-and-decide-safe-cookie-policy.md
[hai9]: ../tasks/9-bound-browser-audio-retention-and-clean-retired-tracks.md
[hai10]: ../tasks/10-use-backend-format-metadata-for-playback-and-downloads.md
[hai11]: ../tasks/11-document-actual-contracts-and-finish-the-existing-release-gate.md
