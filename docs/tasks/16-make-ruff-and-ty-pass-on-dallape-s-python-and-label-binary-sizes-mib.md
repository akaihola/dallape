Steward issue, 2026-10-22 04:23 refill. Goal: music (dallape is tier 3). Estimated 45 min.

[The 2026-10-22 docs review](../reviews/2026-10-22-docs-review.md) found that Ruff and ty both exit 1 on current `main`, and that the UI labels binary sizes as MB. Every worker's edit hooks report the same old diagnostics, so each later change in this repository starts with noise to rule out. The review's draft issues proposed both fixes; this issue takes them together.

## Findings on `main` (`6aa4536` and later)

- Ruff: I001, SIM102 and BLE001 in `backend/app.py`; EXE001 in `tools/check_tasks_md.py`.
- ty: two `unsupported-operator` errors for arithmetic on a nullable `end` in `read_chunks` (`backend/app.py`).
- `fmtSize` in `frontend/app.js` divides by 1048576 but labels the result `MB`. Configuration and the cache contract already use MiB (review question Q1).

## What to do

1. Reproduce both tool failures with the invocations the review's execution record used, then fix each diagnostic in code without changing behaviour. For BLE001, keep the broad handler that sanitises stream errors (its purpose is tested); a targeted `# noqa: BLE001` with a one-line reason is fine. For EXE001, either set the executable bit or drop the shebang, whichever matches how the Rules invoke the script (`python3 tools/check_tasks_md.py TASKS.md`). For the nullable `end`, make the `None` case explicit; if it is reachable, add a test for it.
2. Keep binary accounting and label these sizes `MiB`, with a focused assertion in the frontend tests for the rendered string.
3. Don't add tool configuration that hides diagnostics wholesale, and don't change other strings or behaviour.

## Constraints and acceptance

- Memory: follow your launch prompt's memory rule, and run one heavy command (test suite, browser, build) at a time.
- No deployment, container build or live YouTube call.
- Acceptance: Ruff and ty exit 0 with the review's invocations; the backend tests, the frontend tests and `python3 tools/check_tasks_md.py TASKS.md` pass; the size label reads MiB and a test asserts it; the diff touches only the lines these fixes need. Handoff: a short outcome and the checks run; detail goes in this task record.

Tracker: [the dallape tracker](../../TASKS.md).
