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
