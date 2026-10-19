# Issue tracking for Dallapé

Rules for TASKS.md usage are at the bottom of the file.

## Unverified proposals

## Ordered backlog

- [3] Check the 2026-09-19 architecture review's remediation plan against the
  code and draft what remains
  <!-- hai:{"id":"simple-8b6762e0-3247-4251-8e4d-7d32bc872963","labels":["steward","review"],"createdAt":"2026-10-19T11:13:09.552Z","updatedAt":"2026-10-19T11:13:09.552Z"} -->

## Scheduled

## In Progress

- [*] Scanners found the hostname within two minutes of the certificate being issued,
  and each probe wakes the container. That costs little, but it means fewer true cold
  starts. Let's block the obvious probe paths (`/.env*`, `/.git/*`) with a Cloudflare
  WAF rule.

## Completed / Accepted

- [ ] [2] Gather acceptance evidence for the 5 legacy review-queue items
      <!-- hai:{"id":"simple-365744dc-1e09-4c8c-a42e-0f545e074764","labels":["steward"],"createdAt":"2026-10-17T20:09:29.021Z","updatedAt":"2026-10-17T20:16:19.405Z"} -->

- [ ] [1] Deploy and validate the app on a Scaleway Serverless Container behind a
  Cloudflare loading Worker, following drum-transcribe.
- [ ] [*] Retry what task 5f5f0c2e-1492-41fc-bc30-4d7209808ebf tried, but now with `, scw`.
- [ ] [*] If on a NixOS host with no `scw` installed but `comma` available, always use
  `, scw` instead of just `scw`.
- [ ] [*] Create a `Dockerfile` for running the backend on Google Cloud Run, Fly.io, or an
  always-on VPS. Build and test it.
- [ ] [*] Include `N kbps` in the downloaded file names.

[*]: TASKS.md
[1]: docs/tasks/1-scaleway-deployment.md

---

[2]: docs/tasks/2-gather-acceptance-evidence-for-the-5-legacy-review-queue-items.md

<!-- hai:reserved-numbers:1,2,3 -->

[3]: docs/tasks/3-check-the-2026-09-19-architecture-review-s-remediation-plan-against-th.md

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

- Merge the rebased branch on `main`, and remove the worktree and branch.
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
