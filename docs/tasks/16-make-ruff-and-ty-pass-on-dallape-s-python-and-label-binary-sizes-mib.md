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

## Execution record, 2026-10-22

Worked on the task branch rebased onto `main` at `c7bdca6` (the start move).

### Reproduction

From the repository root, `ruff check --output-format json backend/app.py
tools/check_tasks_md.py` (Ruff 0.16.8) exited 1 with I001, SIM102 and BLE001 in
`backend/app.py` and EXE001 in `tools/check_tasks_md.py`. From `backend/` with
the locked environment synced, `ty check --output-format concise app.py`
exited 1 with the two `unsupported-operator` errors on `end` in `read_chunks`.
Without a synced `backend/.venv`, ty also reports unresolved imports, so the
review's invocation assumes `uv sync --frozen` in `backend/` first.

### Changes

- **I001:** removed the blank line that split `anyio` from the other
  third-party imports in `backend/app.py`.
- **SIM102:** merged the nested Content-Range check into `if ranged and …`.
- **BLE001:** kept the broad handler that sanitizes stream errors and added
  `# noqa: BLE001` with a one-line reason. No Ruff configuration was added.
- **EXE001:** dropped the shebang from `tools/check_tasks_md.py`, because the
  Rules, its usage text and the development guide all run it as
  `python3 tools/check_tasks_md.py TASKS.md`.
- **Nullable `end`:** `expected` and the loop exit now test `end is None`
  instead of `not ranged`. `end` is `None` exactly when `ranged` is false, so
  behaviour is unchanged. The `None` case is reachable for any format without
  both `http_chunk_size` and `filesize`. `test_whole_response_lengths` in
  `backend/tests/test_stream.py` already covers it with unranged formats, both
  with and without a known size, so no test was added.
- **Size label:** `fmtSize` in `frontend/app.js` keeps dividing by 1048576 and
  now renders `MiB`. The existing assertion in `frontend/tests/app.test.js`
  now expects `Estimated 1.0 MiB`. With the old `MB` label restored temporarily,
  that assertion failed, so it guards the rendered string.

### Checks

- Ruff with the review's invocation: exit 0, no diagnostics.
- ty with the review's invocation from `backend/`: exit 0, all checks passed.
- `uv run --frozen pytest` from `backend/`: 70 passed, plus the known Starlette
  `BlockingPortal` deprecation warning.
- `node --test frontend/tests/*.test.js`: 39 passed, 0 failed.
- `python3 tools/check_tasks_md.py TASKS.md`: passed.
- No deployment, container build or live YouTube call was made.

### Guarded command resource record

- **uv-sync:** `uv sync --frozen` in `backend/`. Outcome: started at once; wait 0 s; MemAvailable admission 2056 MiB, final 2062 MiB; starting swap 2302 MiB, swap growth 2 MiB; elapsed 5.7 s; exit 0.
- **backend-tests:** `uv run --frozen pytest -q` in `backend/`. Outcome: started at once; wait 0 s; MemAvailable admission 2091 MiB, final 2133 MiB; starting swap 2303 MiB, swap growth 13 MiB; elapsed 20.2 s; exit 0.
- **frontend-tests:** `node --test frontend/tests/*.test.js`. Outcome: started at once; wait 0 s; MemAvailable admission 2229 MiB, final 2180 MiB; starting swap 2316 MiB, swap growth 0 MiB; elapsed 1.1 s; exit 0.

The one-second mutation check (`node --test frontend/tests/app.test.js`, with
the old label restored) ran without the guard. Ruff, ty and the tracker check
are short, light commands and also ran without it.
