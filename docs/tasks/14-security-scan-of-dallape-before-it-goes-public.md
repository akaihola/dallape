Steward issue, 2026-10-21 12:09 refill. Goal: music (dallape is tier 3 in `<steward-vault>/Goals.md`). Labelled `security` (security reviews stay on Claude, steward decision D68). Estimated 1.5 h.

dallape is meant to run as a public web service: its backend fetches YouTube audio with yt-dlp for anonymous visitors, a Cloudflare worker sits in front, and [1] deploys it on Scaleway. A public service needs a security review before it goes live, and dallape has never had one. Its [architecture re-check of 2026-10-21](../reviews/2026-10-21-architecture-recheck.md) ([12]) covered correctness only. [8] already owns bounding public audio work and the cookie policy; this review covers everything else and may add evidence to [8].

## Work

1. Use the `security-review` skill over `backend/`, `frontend/`, `deploy/` (including `deploy/cloudflare/worker.js` and the Dockerfile) and `tools/`.
2. Look for: visitor input that reaches yt-dlp, a subprocess or an outgoing request without checks (option injection, other sites than YouTube, internal addresses); response headers and CORS that let another site use the service or read its responses; script injection through titles, metadata or error text shown in the page; paths or file names from input that reach the file system; cookie or credential files that could reach a response, a log or the image; the worker's routing and caching rules; and secrets committed in the tree or history (`git log -p` searches: name the file and commit, never the value).
3. Write the report to `docs/reviews/2026-10-21-security-review.md`: findings ranked by impact and likelihood, each with file and line evidence, and a drafted issue (title, work, acceptance) for each fix worth making. Leave out what [7], [8] or [11] already cover, and name the issue. Link paths as relative links. Don't fix anything in this issue.
4. A live credential in the tree or history is urgent: say so first in your completion message, with its location only.

## Acceptance

- The report exists, covers every area in step 1 or says why it was skipped, and drafts an issue for each finding worth fixing.
- No live YouTube request and no image build; reason from the code and local fixtures.
- No secret value appears in the report, the commit or the thread.
- Read-only: no code change, credential use, network call to a service, push, deploy or service restart. Don't read `~/.config/secrets/` or credential files; the code tells you how they're used.
- Memory: before each command, wait up to 10 minutes for `MemAvailable` of at least 2 GiB; if it doesn't come, start the command anyway when at least 1.5 GiB is available. Stop a running command when `MemAvailable` falls below 1 GiB or swap grows by more than 512 MiB. Run one heavy command at a time, and bound any background job you start.
