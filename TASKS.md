# Issue tracking for Dallapé

Rules for TASKS.md usage are at the bottom of the file.

## Unverified proposals

- [11] Document actual contracts and finish the existing release gate
    - Depends on: [4], [5], [6], [7], [8], [9], [10]

  <!-- hai:{"id":"simple-3843159a-e875-4f62-b0ce-57547499e312","labels":["steward"],"createdAt":"2026-10-19T11:15:26.828Z","updatedAt":"2026-10-19T11:15:26.828Z"} -->

- [8] Bound public audio work and decide safe cookie policy
    - Depends on: [6], [7]

  <!-- hai:{"id":"simple-add37768-9d63-44e2-8737-78af0f311881","labels":["steward"],"createdAt":"2026-10-19T11:15:25.934Z","updatedAt":"2026-10-19T11:15:25.934Z"} -->

- [7] Verify a reproducible YouTube-capable release image
  <!-- hai:{"id":"simple-780b4cb2-dcde-49ed-b332-27058aaa9e22","labels":["steward"],"createdAt":"2026-10-19T11:15:25.662Z","updatedAt":"2026-10-19T11:15:25.662Z"} -->

## Ordered backlog

## Scheduled

## In Progress

- [~] [*] Deploy the scanner-probe WAF rule defined in
      `docs/tasks/1-scaleway-deployment.md` (needs a Zone WAF Write token).
      <!-- hai:{"id":"simple-f44c0a9406fd9745","updatedAt":"2026-10-19T15:29:01.637Z"} -->

## Completed / Accepted

- [ ] [17] Background tab audio stutter on Firefox
      <!-- hai:{"id":"simple-694efe55-4ec6-41bf-a0a7-6dc9ab0a37f2","priority":"none","labels":[],"createdAt":"2026-10-24T07:11:53.138Z","updatedAt":"2026-10-24T07:45:57.055Z"} -->

- [x] [16] Make Ruff and ty pass on dallape's Python and label binary sizes MiB
      <!-- hai:{"id":"simple-13e58592-201a-4ad4-a382-25fb0d51085b","labels":["steward"],"createdAt":"2026-10-22T01:31:11.300Z","updatedAt":"2026-10-22T07:51:15.184Z"} -->

- [x] [15] Check dallape's documents, docstrings and comments against current main
      <!-- hai:{"id":"simple-a7cbbe23-c23d-4845-829a-6589c61ea304","labels":["steward","review"],"createdAt":"2026-10-22T00:17:01.967Z","updatedAt":"2026-10-22T03:25:21.366Z"} -->

- [x] [14] Security scan of dallape before it goes public
      <!-- hai:{"id":"simple-a5a897e9-e1f7-4c8b-a41b-fd4d4cdf15e3","labels":["steward","security"],"createdAt":"2026-10-21T09:24:16.679Z","updatedAt":"2026-10-21T21:53:53.981Z"} -->

- [x] [13] Preserve audio downloads after playback fails before EOF
      <!-- hai:{"id":"simple-b0d297ff-d8e0-4c63-bc53-27eeed26f0f4","labels":["steward"],"createdAt":"2026-10-21T09:24:14.668Z","updatedAt":"2026-10-21T21:53:54.834Z"} -->

- [x] [12] Re-check the 2026-09-19 architecture review against current main
      <!-- hai:{"id":"simple-5d60f3d5-e3a2-46bf-b0f2-6a259f436766","labels":["steward","review"],"createdAt":"2026-10-21T05:37:54.352Z","updatedAt":"2026-10-21T11:12:38.156Z"} -->

- [x] [9] Bound browser audio retention and clean retired tracks
    - Depends on: [4], [5]

      <!-- hai:{"id":"simple-6f6789e7-3748-490c-97d8-cdb26ac151fc","labels":["steward"],"createdAt":"2026-10-19T11:15:26.218Z","updatedAt":"2026-10-21T05:15:28.558Z"} -->

- [x] [10] Use backend format metadata for playback and downloads
    - Depends on: [5]

      <!-- hai:{"id":"simple-20fa9eb2-cdcf-466f-be82-c8890cb2d100","labels":["steward"],"createdAt":"2026-10-19T11:15:26.542Z","updatedAt":"2026-10-21T05:15:30.669Z"} -->

- [x] [5] Activate replacement audio only when it can play
    - Depends on: [4]

      <!-- hai:{"id":"simple-07d103ef-891b-4179-8e54-1b81a6cb7c3d","labels":["steward"],"createdAt":"2026-10-19T11:15:25.075Z","updatedAt":"2026-10-21T05:15:33.066Z"} -->

- [x] [6] Validate audio stream bytes and failure recovery
    - Depends on: [4]

      <!-- hai:{"id":"simple-8e0f78ba-f8d0-493a-a5aa-a70cbcb622ab","labels":["steward"],"createdAt":"2026-10-19T11:15:25.358Z","updatedAt":"2026-10-21T05:15:35.178Z"} -->

- [x] [4] Fix audio request ownership and retry recovery
      <!-- hai:{"id":"simple-b2093cf7-c9ea-4453-80cb-a8ecd7453b3f","labels":["steward"],"createdAt":"2026-10-19T11:15:24.739Z","updatedAt":"2026-10-21T05:15:37.350Z"} -->

- [x] [3] Check the 2026-09-19 architecture review's remediation plan against the
  code and draft what remains
      <!-- hai:{"id":"simple-8b6762e0-3247-4251-8e4d-7d32bc872963","labels":["steward","review"],"createdAt":"2026-10-19T11:13:09.552Z","updatedAt":"2026-10-19T14:05:44.353Z"} -->

- [x] [2] Gather acceptance evidence for the 5 legacy review-queue items
      <!-- hai:{"id":"simple-365744dc-1e09-4c8c-a42e-0f545e074764","labels":["steward"],"createdAt":"2026-10-17T20:09:29.021Z","updatedAt":"2026-10-21T17:11:47.796Z"} -->

- [x] [1] Deploy and validate the app on a Scaleway Serverless Container behind a
  Cloudflare loading Worker, following drum-transcribe.
      <!-- hai:{"updatedAt":"2026-10-24T07:09:36.901Z"} -->
- [ ] [*] Retry what task 5f5f0c2e-1492-41fc-bc30-4d7209808ebf tried, but now with `, scw`.
- [ ] [*] If on a NixOS host with no `scw` installed but `comma` available, always use
  `, scw` instead of just `scw`.
- [x] [*] Create a `Dockerfile` for running the backend on Google Cloud Run, Fly.io, or an
  always-on VPS. Build and test it.
      <!-- hai:{"id":"simple-87d137b900ac5652","updatedAt":"2026-10-21T05:30:49.274Z"} -->
- [x] [*] Include `N kbps` in the downloaded file names.
      <!-- hai:{"id":"simple-17dcd69e10062d36","updatedAt":"2026-10-21T05:30:51.528Z"} -->

[*]: TASKS.md
[1]: docs/tasks/1-scaleway-deployment.md

---

[2]: docs/tasks/2-gather-acceptance-evidence-for-the-5-legacy-review-queue-items.md

<!-- hai:reserved-numbers:1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17 -->

[3]: docs/tasks/3-check-the-2026-09-19-architecture-review-s-remediation-plan-against-th.md

[4]: docs/tasks/4-fix-audio-request-ownership-and-retry-recovery.md

[5]: docs/tasks/5-activate-replacement-audio-only-when-it-can-play.md

[6]: docs/tasks/6-validate-audio-stream-bytes-and-failure-recovery.md

[7]: docs/tasks/7-verify-a-reproducible-youtube-capable-release-image.md

[8]: docs/tasks/8-bound-public-audio-work-and-decide-safe-cookie-policy.md

[9]: docs/tasks/9-bound-browser-audio-retention-and-clean-retired-tracks.md

[10]: docs/tasks/10-use-backend-format-metadata-for-playback-and-downloads.md

[11]: docs/tasks/11-document-actual-contracts-and-finish-the-existing-release-gate.md

[12]: docs/tasks/12-re-check-the-2026-09-19-architecture-review-against-current-main.md

[13]: docs/tasks/13-preserve-audio-downloads-after-playback-fails-before-eof.md

[14]: docs/tasks/14-security-scan-of-dallape-before-it-goes-public.md

[15]: docs/tasks/15-check-dallape-s-documents-docstrings-and-comments-against-current-main.md

[16]: docs/tasks/16-make-ruff-and-ty-pass-on-dallape-s-python-and-label-binary-sizes-mib.md

[17]: docs/tasks/17-background-tab-audio-stutter-on-firefox.md

## Rules

Here are the rules for TASKS.md usage:

### Invariant: one heading per issue

At any time, each issue's bullet must be under exactly one `##` heading (for example
`## Ordered backlog` or `## In Progress`). It must never be under two headings at the
same time.

- Before you commit any change to TASKS.md, run:
  `python3 tools/check_tasks_md.py TASKS.md`
- The check must pass (exit code 0) before the commit.
- If the check fails, it prints the duplicated bullet. Remove the bullet from all but
  one heading before you commit.

### TASKS.md maintenance sessions

- In `## Completed / Accepted`, `- [ ] [N] summary` or `- [ ] [*] summary`
  means completed work awaiting user acceptance. `- [x] [N] summary` or
  `- [x] [*] summary` means the user has accepted it. Only user acceptance, or the steward's under its
  acceptance policy, changes `[ ]` to `[x]`; completion, tests and deployment do not.
- Move newly completed issues into `## Completed / Accepted` with `[ ]`.
- During the next maintenance run, remove only `[x]` issues from this section,
  plus their unused description files and reference-style links. Keep `[ ]`
  issues and any files or links still referenced by another issue.
- Each issue in every section must retain either
    - a numbered reference-style link (e.g. `[1]`) to a description file, or
    - `[*]` to indicate no description file is needed for a simple task.
- Link references are listed between `## Completed / Accepted` and `## Rules`.
- If any issue is missing a link:
    - Create the first missing numbered description file in
      docs/tasks/<N-issue-description>.md and add the link

### Modifying issues

- Ensure dependencies between issues are correctly updated.
- State dependencies using
    - indented `- Depends on: [N]` bullets in TASKS.md, and
    - YAML frontmatter in description files.
- Ensure backlog order respects dependencies.
- When you move an issue, preserve its identifier, text and line wrapping.
  Change only the status checkbox when completion or user acceptance requires it.
  This keeps moves identifiable in Git and reduces avoidable conflicts.

### Workflow for new issue completion

1. Choose issue and schedule work (typically by a heartbeat)

- Pick the first backlog issue with no dependency to any uncompleted issue.
- Move it under `## Scheduled` in `TASKS.md` and remove it from `## Ordered backlog` in
  the `main` branch and commit.

2. Work on the issue (typically by a task workflow)

- Rebase the worktree feature branch on `main` before moving the issue, and keep it
  rebased afterwards.
- Move the issue under `## In Progress` in `TASKS.md` in the worktree branch, ensure
  it's not in `## Ordered backlog`, and commit.
- Create or update, review and refine a plan in docs/tasks/<N-issue-description>.md in
  `main` if more description is needed than nicely fits in a bullet point. If you
  created a plan document, link to it using a new `[N]` reference-style link.
- Commit the description file (if any) in `main`.
- Implement the plan, and lint, test, review and refine the implementation in the
  worktree feature branch.

3. Merge and deploy (typically by last steps of a task workflow)

- Merge the rebased branch on `main`.
- Keep the worktree and branch after merging. Remove them only when the user
  explicitly requests it.
- Move the issue from `## In Progress` to `## Completed / Accepted` in TASKS.md with `[ ]`,
  pending user acceptance, and commit.
- Do any deployment steps if defined in the general development worklow.

When TASKS.md conflicts during a rebase or merge:

- Use `main`'s version of every section as the base.
- Apply again only the move of your own issue.
- Never restore, add again or re-word another issue's bullet from your side of the
  conflict.
- After resolving the conflict, read the whole file and ensure that each bullet is under
  exactly one `##` heading.
