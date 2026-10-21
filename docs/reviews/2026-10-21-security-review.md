# Security review, 2026-10-21

Checked local `main` at **`e4f4345`** (HAI-14 start). The reviewed code has not
changed since the HAI-13 merge `d864afb`. Locked runtime libraries: FastAPI
0.141.1, Starlette 1.6.0, uvicorn 0.52.4, yt-dlp 2026.8.19
([backend/uv.lock][uv-lock]).

**No credential is committed in the tree or in any of the 125 commits reachable
from the repository's 30 refs.** The review found no injection, script
injection, request forgery, path traversal or header injection in the code.
Three findings are worth fixing. All three concern what the public deployment
allows, not a code defect:

| Rank | Finding | Impact | Likelihood |
|---|---|---|---|
| S1 | Any website can use the API from its visitors' browsers (CORS `*`) | Low–Medium | Medium |
| S2 | The origin is reachable without Cloudflare, and the docs publish its address | Low now; Medium if [8] relies on Cloudflare | Medium |
| S3 | Public responses and the image lack defence-in-depth hardening (docs routes, security headers, root user, stray files, download names) | Low | Low |

The service is already public. [The deployment record][deploy-result] has it
live at `dallape.vempai.men` since 2026-09-26, and scanners found the hostname
within two minutes of its certificate being issued. The findings apply to the
running service now, not only at a later launch.

## Scope and method

Areas: [backend/][backend-dir], [frontend/][frontend-dir], [deploy/][deploy-dir]
(including [deploy/cloudflare/worker.js][worker],
[deploy/cloudflare/wrangler.toml][wrangler] and [deploy/Dockerfile][dockerfile]),
[.dockerignore][dockerignore] and [tools/][tools-dir]. Tests and fixtures were read
as evidence of intended behaviour, not reviewed as attack surface.

The `security-review` skill targets a branch diff. Here it was applied to the
whole tree with its three steps. One sub-task identified candidates in the
skill's classes (injection, script injection, request forgery, path traversal,
secrets, authentication bypass, data exposure) and in this issue's areas.
It proposed three, matching S1, S2 and the docs-route part of S3, at 9, 8 and 9
out of 10. A separate false-positive filter per candidate scored each 2/10, and
the skill keeps only 8 or more:

- S1 falls under resource abuse and hardening.
- S2 falls under documentation-only disclosure, hardening, and rate limiting
  that does not exist yet.
- The docs routes are hardening without an attack path.

The skill therefore confirms **no vulnerability**. Each filter still judged its
item worth fixing or deciding, and this issue asks explicitly about CORS,
response headers and the worker's routing. So S1–S3 are reported here as
deployment findings, ranked by impact and likelihood, not as exploitable
defects.

Limits: no live YouTube or service request, no image build, no credential or
cookie file read. Library behaviour comes from the locked versions' source in
the main checkout's virtual environment. The history scan streamed
`git log --all -p -m` and matched token formats (cloud, GitHub, Google, Slack
and `sk-` keys, private keys, bearer tokens, credentials in URLs, Netscape and
YouTube cookie lines, keyword assignments) plus high-entropy strings. Matches
were recorded as commit, file and redacted context only. Unreachable objects
were not scanned; they are not pushed.

## Findings

### S1 — Any website can use the API from its visitors' browsers

- **Evidence:** [backend/app.py:181–186][app] installs `CORSMiddleware` with
  `allow_origins=os.environ.get("ALLOWED_ORIGINS", "*")`. The
  [deployment record][deploy-result] (lines 85–87) sets no environment
  variables, so `ALLOWED_ORIGINS` keeps `*`. The plan's
  [container assumptions][deploy-assumptions] had listed
  `ALLOWED_ORIGINS=https://dallape.vempai.men` instead.
  [README.md:188–191][readme] presents the default as a feature: "CORS origins for
  third-party API users, default `*`". The shipped frontend does not need CORS:
  [frontend/config.js:3][config] uses the same origin.
- **Effect:** every `/api/formats` and `/api/audio` response is readable from any
  web page. Another site can put a YouTube audio downloader in front of
  dallape: its visitors' browsers call
  `https://dallape.vempai.men/api/audio?url=<id>&format=251` and receive the
  whole file. Dallape pays the extraction and streaming time. Its Scaleway egress
  addresses also carry the YouTube bot-check risk, and bot checks push towards
  cookie mode. Visitor data is not exposed: there are no credentials, no cookies, and
  `allow_credentials` is off.
- **Likelihood:** medium. The README advertises the open API, and downloader
  front ends look for free keyless backends. **Impact:** low to medium, bounded
  later by [8]'s admission limits. A server can already proxy the API without
  CORS. What `*` adds is free use from browsers: the third party needs no
  server, and each request comes from a different visitor's address, which
  defeats per-address limits.
- **Why not [8]:** [8] asks only to verify documented CORS behaviour and not to
  present CORS as authentication. Nothing there decides whether other sites may
  use the API from browsers. CORS does not stop server-side clients; those stay
  with [8].
- **Fix:** default to same-origin only, and keep `ALLOWED_ORIGINS` as an
  explicit opt-in for named third parties. See draft D1.

### S2 — The origin is reachable without Cloudflare, and the docs publish its address

- **Evidence:** the [deployment record][deploy-result] (lines 82 and 87–88) lists
  the container as `public` and writes out its own
  `*.functions.fnc.fr-par.scw.cloud` URL, repeated as the CNAME target on
  line 94. Nothing in [backend/app.py][app] checks that a request came through
  Cloudflare. [deploy/cloudflare/worker.js:44][worker] forwards requests
  unchanged and adds no marker.
- **Effect:** a client that calls the container URL skips everything Cloudflare
  does. That includes the defined
  [scanner-probe WAF rule][waf] (In Progress in the [tracker]), any Cloudflare rate
  limiting or bot rule that [8] might choose, and the loading page. On a direct
  request, `CF-Connecting-IP` and `X-Forwarded-For` are set by the caller, so
  per-client admission keyed on them can be spoofed. Removing the URL from the
  docs alone is not enough: it stays in history, and Scaleway likely also routes
  the custom domain by `Host` at its shared ingress.
- **Likelihood:** medium once the repository is public. **Impact:** low today,
  because Cloudflare enforces no access control yet. It becomes medium if [8]
  puts any limit at Cloudflare or trusts its client-IP headers.
- **Fix:** decide whether Cloudflare is a security boundary. If it is, make the
  origin accept only Cloudflare-forwarded requests. If not, document that
  origin-side limits must not trust Cloudflare headers. See draft D2.

### S3 — Public responses lack defence-in-depth hardening

- **Interactive API docs on the public origin.** [backend/app.py:180][app]
  creates `FastAPI(title="Dallapé API")` with the default `/docs`, `/redoc` and
  `/openapi.json` routes, registered before the `/` static mount at
  [backend/app.py:237][app]. `/docs` and `/redoc` load Swagger UI and ReDoc
  scripts from `cdn.jsdelivr.net` (`swagger-ui-dist@5`, `redoc@2`, floating
  major versions) into dallape's origin. Today the origin holds no session or
  secret for such a script to take, so the risk is low; the routes are not
  needed in production.
- **No security headers.** Starlette's static files, the API and the
  [worker][worker] add no `Content-Security-Policy`, `X-Content-Type-Options`,
  `Referrer-Policy` or `frame-ancestors`. The frontend has no HTML-injection
  sink today (see [area coverage](#area-coverage)), so a policy is a second
  layer. It would stop a future `innerHTML` regression from running script, and
  limit what the third-party YouTube iframe API script
  ([frontend/app.js:55][frontend-app]) may load.
- **Root in the container.** [deploy/Dockerfile][dockerfile] has no `USER`.
  yt-dlp parses untrusted YouTube responses, and under [7] it may run YouTube's
  player code in a challenge runtime. A parser or runtime bug would run as root
  inside Scaleway's sandbox.
- **Whatever is in the working tree's `frontend/` ships and is public.** The
  build context allows `frontend/` as a whole ([.dockerignore:5][dockerignore]),
  [deploy/Dockerfile:8][dockerfile] copies the builder's directory, untracked
  files included, and `StaticFiles` serves every file under it, dotfiles
  included. [.gitignore][gitignore] has no pattern for `.env*`, `.secrets*` or
  `cookies*.txt`, although [README.md:180–191][readme] works with exactly such
  files. A cookie export saved into `frontend/` by mistake would be served at
  `/`. Verifying the built image's contents remains [7]'s job.
- **Download names keep control and bidi characters.** Titles go into the
  download name unchanged ([backend/app.py:74–77][app],
  [frontend/app.js:468][frontend-app]). Percent-encoding rules out header
  injection, but a title containing U+202E (right-to-left override) can make the
  saved name read misleadingly. The real `.webm`/`.m4a` extension always comes
  last, so the effect is cosmetic.
- **Likelihood:** low. **Impact:** low. See draft D3.

## Evidence for [8]

[8] owns the cookie policy, public work bounds and log hygiene. This review adds:

- yt-dlp 2026.8.19 writes the cookie jar back on every `close()`
  (`YoutubeDL.close` calls `save_cookies` whenever `cookiefile` is set).
  `/api/formats` opens one `YoutubeDL` and `/api/audio` two
  ([backend/app.py:64][app], [backend/app.py:103][app]). With `YTDLP_COOKIEFILE`
  set, every request rewrites the one shared file, and concurrent requests race
  on it.
- If cookie mode is kept, the cookie file must live outside `/app/frontend`:
  [backend/app.py:235–237][app] serves that whole directory at `/`.
- `quiet` and `no_warnings` ([backend/app.py:54–55][app]) do not silence errors.
  yt-dlp's `to_stderr` ignores `quiet`, so its `ERROR:` lines reach the
  container log. Public response bodies stay generic: [backend/app.py:150–152][app],
  [:192][app], [:196][app], [:220][app], [:231][app].
- **A malformed cookie-file line reaches the log with its value.** yt-dlp's
  Netscape loader skips a line with the wrong field count or a bad expiry, and
  prints `WARNING: skipping cookie file entry due to …: <the whole line>`
  through `write_string`, which no option silences (`yt_dlp/cookies.py:1386`).
  A pasted cookie export with spaces instead of tabs would put session cookie
  values into the container log on the first requests. The next `close()`
  then drops those entries from the file.
- **A cookie file that fails to load gives a 500 and a traceback.**
  `CookieLoadError` is re-raised past extraction (`YoutubeDL.py:1732`), and the
  cookie loader reports its cause with a traceback (`YoutubeDL.py:4224–4231`).
  It is not a `DownloadError`, so it escapes
  [backend/app.py:193–196][app]: the visitor gets a generic 500 and the log gets
  the traceback.
- uvicorn's default `forwarded_allow_ips` is `127.0.0.1`
  ([deploy/Dockerfile:10][dockerfile] sets nothing), so the app sees the
  platform proxy's address, not the visitor's. Per-client admission needs a
  trusted client-IP source, which S2 currently prevents.
- Cross-origin browser use (S1) is one source of the anonymous load that [8]
  must bound.

## Area coverage

- **Visitor input to yt-dlp, subprocesses and outgoing requests — no finding.**
  Input is reduced to an 11-character ID ([backend/app.py:19–47][app]). That
  covers scheme, credentials, port and the exact host set
  ([backend/app.py:20][app], [:37–40][app]). The URL handed to yt-dlp is rebuilt
  from the ID ([backend/app.py:65][app]), and `allowed_extractors: ["youtube"]`
  ([backend/app.py:52][app]) matches by case-insensitive full match. yt-dlp is
  called as a library, so no option string is parsed. `format` only selects
  among extracted IDs ([backend/app.py:219–221][app]). The only other outgoing
  request is the extracted media URL, restricted to `http`/`https` formats
  ([backend/app.py:87][app], [:111][app]). Visitor input cannot choose another
  site or an internal address. Tests cover rejection and allowlist bypass
  ([backend/tests/test_app.py][backend-tests]: `test_parse_youtube_rejects`,
  `test_malformed_authority_parity`,
  `test_format_allowlist_cannot_be_bypassed_by_unknown_ids`). The frontend
  mirrors the parser ([frontend/providers.js:22–41][providers]).
- **Response headers and CORS — S1, S3.**
- **Script injection through titles, metadata or error text — no finding.**
  The only `innerHTML` is a constant template ([frontend/app.js:146–157][frontend-app]).
  Titles and format metadata reach the page through `textContent`, `setAttribute`
  and the `download` property ([frontend/app.js:448–468][frontend-app]). Error
  text, including the backend's `detail`, goes to an `<output>` element's
  `value` ([frontend/app.js:99][frontend-app], [:137][frontend-app],
  [:166][frontend-app], [:191][frontend-app], [:244][frontend-app], [:279][frontend-app],
  [:305][frontend-app]; [frontend/index.html:19][index]). The API returns JSON or
  audio with fixed error strings. The worker's loading page is a constant
  ([deploy/cloudflare/worker.js:7–34][worker]).
- **Paths and file names from input — no finding.** The download name is
  percent-encoded with `quote(…, safe="")` before it enters
  `Content-Disposition`, so a title cannot inject a header
  ([backend/app.py:74–77][app], [:222–223][app]). The browser sanitises the
  `download` name ([frontend/app.js:468][frontend-app]). Starlette's
  `StaticFiles` keeps paths inside its directory with a `commonpath` check, and
  yt-dlp runs with `skip_download` and `download=False`
  ([backend/app.py:56][app], [:65][app]), so no output template exists.
- **Cookie and credential files in responses, logs or the image — no finding
  beyond [8].** `YTDLP_COOKIEFILE` is only a path from the environment
  ([backend/app.py:58–59][app]). The extracted `url` and `http_headers` are not
  among the fields `/api/formats` returns ([backend/app.py:81][app]), and stream
  errors drop their cause ([backend/app.py:150–152][app]). The image
  build context is an allowlist ([.dockerignore][dockerignore]) and the Dockerfile
  copies named paths only ([deploy/Dockerfile:5–8][dockerfile]). The deleted
  `backend/Dockerfile` copied named files only as well. Verifying the built
  image's contents belongs to [7].
- **Worker routing and caching — S2; otherwise no finding.** The worker runs on
  `dallape.vempai.men/*` ([deploy/cloudflare/wrangler.toml:8][wrangler]).
  `/api/*` has a no-Worker route, managed outside the repository. The worker
  forwards every request unchanged ([deploy/cloudflare/worker.js:44–45][worker])
  and replaces only slow or 502+ navigations with a constant 503 page marked
  `no-store` ([deploy/cloudflare/worker.js:36–49][worker]). It reflects no input,
  uses no `env` secret and sets no cache rule. Cloudflare's default extension-based caching
  stores `.js` and `.css` but not `/api/*`, which has no extension. The origin
  serves the same bytes to every visitor, so the cache holds nothing
  visitor-specific. The docs already require a purge after frontend deploys.
- **Secrets in the tree and history — none.** Every match was a file path, URL,
  Hai issue ID or test fixture. The two "credentials in URL" matches are the
  URL-parser rejection cases in [backend/tests/test_app.py][backend-tests] and
  [frontend/tests/providers.test.js][providers-tests]. The docs name where
  credentials live (a Scaleway CLI profile and a Cloudflare env file on atom)
  and list Scaleway and Cloudflare resource IDs. The
  [2026-09-19 review][original-review] links a tailnet host name. None of these
  is a credential; whether to keep them in a public repository is a publication
  choice, recorded in D2.
- **tools/ — no finding.** [tools/check_audio_browser.mjs][check-audio] is a
  local test harness: it binds `127.0.0.1` (line 30), serves a fixed file map
  (lines 22–25) and runs `ffmpeg` with fixed arguments (lines 17–18).
  [tools/check_tasks_md.py][check-tasks] reads the file named on its command
  line. Neither ships in the image.

Covered elsewhere and left out: admission, deadlines, size limits and the
cookie decision ([8]); the floating base-image tag
([deploy/Dockerfile:3][dockerfile]), pinned yt-dlp and challenge runtime, and
image contents and CI ([7]); API, limit and cookie-policy documentation and the
release gate ([11]).

## Draft issues

The steward decides whether to file these.

### D1 — Default CORS to same-origin

- **Work:** in [backend/app.py][app], allow no cross-origin access when
  `ALLOWED_ORIGINS` is unset or empty. Install the CORS middleware only for the
  listed origins. Update [README.md][readme] so the variable is an opt-in for
  named third-party sites, and correct the [deployment record][deploy-result]'s
  reasoning. Don't present CORS as access control; [8] still bounds direct
  clients.
- **Acceptance:** with no `ALLOWED_ORIGINS`, an `Origin: https://example.org`
  request to `/api/formats` and `/api/audio`, and a preflight to the same paths,
  get no `Access-Control-Allow-Origin`. With
  `ALLOWED_ORIGINS=https://a.example`, that origin is echoed and others are not.
  Same-origin frontend tests still pass. Backend tests cover both cases with
  canned extraction, no live request.

### D2 — Decide whether Cloudflare is a security boundary, and lock the origin if it is

- **Work:** record the decision in [docs/tasks/1-scaleway-deployment.md][deploy-result].
  If Cloudflare is a boundary: make the origin refuse requests that did not come
  through the zone. For example, a Cloudflare request-header transform adds a
  secret header on both the Worker route and the `/api/*` route, the app
  compares it in constant time, and the value lives in a Scaleway secret
  environment variable. Otherwise use Scaleway's private-container token,
  injected by Cloudflare. Then recreate or rename the container so the published
  hostname stops working. If Cloudflare is not a boundary: document that
  origin-side limits must not trust `CF-Connecting-IP` or `X-Forwarded-For`, and
  tell [8]. Before the repository goes public, decide which operational details
  stay in the docs: the origin URL, resource IDs, credential locations and the
  tailnet host name.
- **Acceptance:** the decision is written down. If the origin is locked, a
  direct request to the container URL, and one sent to Scaleway's ingress with
  `Host: dallape.vempai.men`, gets 403 or no response. The same paths through
  `dallape.vempai.men` still work, including a full `/api/audio` stream and the
  cold-start loading page. The secret never appears in the repository, logs or
  responses, and a rotation and rollback step is recorded.

### D3 — Harden public responses and the container

- **Work:** turn off `/docs`, `/redoc` and `/openapi.json` in the public app, or
  serve the schema only. Add `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` and a
  `Content-Security-Policy` to app responses. The policy allows `self` plus the
  YouTube iframe API's script and frame origins, sets
  `frame-ancestors 'none'` and `object-src 'none'`, and has no `unsafe-inline`
  for scripts. Set the headers in the app, so they reach both Worker and non-Worker
  routes. Add an unprivileged `USER` to [deploy/Dockerfile][dockerfile]; check it
  in [7]'s image verification. Add `.env*`, `.secrets*` and `cookies*.txt` to
  [.gitignore][gitignore] and exclude them, plus `frontend/.*`, in
  [.dockerignore][dockerignore]. Replace Unicode control and format characters
  (categories Cc and Cf) and path separators in the title part of download
  names ([backend/app.py:74–77][app]).
- **Acceptance:** `/docs`, `/redoc` and `/openapi.json` return 404 (or only the
  schema, if kept). Backend tests assert the headers on `/`, a static script and
  `/api/formats`. The browser check
  ([tools/check_audio_browser.mjs][check-audio]) and a manual YouTube-player load
  show no CSP violation. The image runs as a non-root user and still writes
  yt-dlp's cache. The container command still honours `PORT`. A build with a
  stray `frontend/cookies.txt` and `frontend/.env` leaves both out of the image.
  A title containing U+202E, a tab and `/` gives a download name without them,
  in both `Content-Disposition` and `/api/formats`.

[8]: ../tasks/8-bound-public-audio-work-and-decide-safe-cookie-policy.md
[7]: ../tasks/7-verify-a-reproducible-youtube-capable-release-image.md
[11]: ../tasks/11-document-actual-contracts-and-finish-the-existing-release-gate.md
[tracker]: ../../TASKS.md
[original-review]: ../2026-09-19-architecture-review-and-remediation-plan.md
[deploy-result]: ../tasks/1-scaleway-deployment.md#result-2026-09-26
[deploy-assumptions]: ../tasks/1-scaleway-deployment.md#container-assumptions
[waf]: ../tasks/1-scaleway-deployment.md#block-scanner-probes-with-cloudflare-waf
[readme]: ../../README.md
[uv-lock]: ../../backend/uv.lock
[backend-dir]: ../../backend/
[frontend-dir]: ../../frontend/
[deploy-dir]: ../../deploy/
[tools-dir]: ../../tools/
[app]: ../../backend/app.py
[backend-tests]: ../../backend/tests/test_app.py
[frontend-app]: ../../frontend/app.js
[providers]: ../../frontend/providers.js
[providers-tests]: ../../frontend/tests/providers.test.js
[config]: ../../frontend/config.js
[index]: ../../frontend/index.html
[worker]: ../../deploy/cloudflare/worker.js
[wrangler]: ../../deploy/cloudflare/wrangler.toml
[dockerfile]: ../../deploy/Dockerfile
[dockerignore]: ../../.dockerignore
[gitignore]: ../../.gitignore
[check-audio]: ../../tools/check_audio_browser.mjs
[check-tasks]: ../../tools/check_tasks_md.py
