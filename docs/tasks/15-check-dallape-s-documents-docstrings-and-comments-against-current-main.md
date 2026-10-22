Steward issue, 2026-10-22 03:00 refill. Goal: music (dallape is tier 3). Labelled `review` (steward D68). Estimated 45 min.

54 commits have landed on `main` since 2026-10-19, including the 10-21 architecture re-check's fixes. Each issue updated the documents only where it touched them, so statements elsewhere may now be stale or in conflict. The repository has few documents, so this check also covers its docstrings and comments. The same check has run for kandev-pacer, Hai, Filemill, pi-akaihola, mailjail, kandev-config and skills-akaihola.

## What to do

1. Read every tracked Markdown file outside `docs/tasks/`, `docs/reviews/` and `TASKS.md` (`git ls-files '*.md'`), `README.md` first, against the code on current `main`: commands, settings and their defaults, file layout, how to run and test, and what each document says is done or planned.
2. Read the module docstrings, function docstrings and comments of the Python and JavaScript sources (`git ls-files`) for statements the code no longer bears out: parameters, return values, units, defaults, invariants.
3. Fix plain discrepancies and stale statements in text only. Where two places explain the same thing, keep one and link to it. Keep entry points short.
4. Where it's unclear whether the code or the text is wrong, don't guess: list it in `docs/reviews/<run date>-docs-review.md` with the evidence and a proposed answer.
5. That file also lists each change you made, by file, with the code it now matches, and ends with a `## Draft issues` section for anything larger than a text fix. Don't file those issues; the steward decides.

## Constraints and acceptance

- Text only: documents, docstrings and comments. No change to code behaviour or tests. Leave task files, earlier reviews and the dated architecture review as they are.
- Before merging, run the tests and checks the Rules and `AGENTS.md` (or the README) ask for, and show they pass unchanged.
- Memory: before each command, wait up to 10 minutes for `MemAvailable` of at least 2 GiB; if it doesn't come, start the command anyway when at least 1.5 GiB is available. Stop a running command when `MemAvailable` falls below 1 GiB or swap grows by more than 512 MiB. Run one heavy command at a time, and bound any background job you start.
- Handoff: a short outcome and the checks run; detail goes in the review file and this task record.
- Acceptance: the review file is on `main`, every document named in step 1 was read, each change it lists names the code it now matches, and the test results match `main` before the change.

Tracker: [the dallape tracker](../../TASKS.md).


## Execution record, 2026-10-22

Implemented the [documentation review] against `main` at
`6aa4536fe81a3c13bdeebdc8060fc1bc1226fc9c`. Start move `6aa4536` was committed
in the canonical checkout first; its tracker was clean before implementation.
The worktree was rebased onto that main commit. The original task brief above
is preserved; this append-only record fulfils the workflow's reporting requirement.
Other task files and historical reviews remain unchanged.

The review inventories all three required Markdown files and all eleven Python/
JavaScript sources, explains every text change against current code, and ends
with draft follow-ups for the steward. The README now links to the consolidated
[audio contract] and [development guide]. No issues were filed.

### Checks and limitations

- **Backend:** `uv run --frozen pytest` from the backend directory: baseline
  70 passed in 5.38 s; final 70 passed in 2.75 s. Python 3.14.7, pytest 9.1.1.
  Both runs have the same Starlette/AnyIO deprecation warning.
- **Frontend:** `node --test frontend/tests/*.test.js`: baseline and final
  39 passed, zero failures/skips/cancellations, Node v24.21.0.
- **Tracker:** `python3 tools/check_tasks_md.py TASKS.md` passed on baseline and
  final worktree. The required active move was sent as the exact single command
  supplied by the task; its update completed before staging/commit. Final main
  checks and completion are recorded below after merge.
- **Scope:** a Python AST comparison ignoring docstrings and a JavaScript
  comment-diff audit passed. All tests, fixture data and historical reviews
  remain byte-identical to baseline; only the owning task's record is appended.
- **Startup:** the documented frozen uvicorn reload command started on a free
  local port; `/`, `/app.js`, `/api/health`, `/docs` and `/openapi.json` returned
  the expected content. The server and reload worker stopped, and the listener
  was confirmed closed. No YouTube request was made.
- **Existing lint/type failures:** Ruff reports I001, SIM102, BLE001 and EXE001;
  ty reports two `unsupported-operator` errors. Explicit runs against canonical
  main and the edited tree both exit 1 with identical diagnostic codes/messages.
  The comparison wrapper exits 0. These pre-existing failures were left unchanged
  under the text-only constraint and are included in the review's draft issues.
- **Release scope:** optional real-browser fixtures, container builds and live
  provider/cloud checks were not rerun for this text audit. Existing release
  tasks still own them. No deployment was performed or claimed.

### Guarded command resource record

Each entry below records the wrapper's host measurements, not command output.
Commands ran sequentially with a ten-minute admission limit (2048 MiB preferred,
1536 MiB fallback), and monitoring that stops the process group below 1024 MiB
or after swap growth over 512 MiB. Test timeouts were 300 s backend / 180 s
frontend; the comparison and source audit used 180 s / 120 s, inventories and
startup 60 s. No fallback, shortage, running stop or provider safeguard occurred.
All start labels are **started at once**, each after a **0.0 s wait**.

- **instructions:** `git ls-files '*.md'` and `git ls-files` (instruction/inventory batch). Outcome: started at once; wait 0.0 s; MemAvailable admission 2979.6 MiB, final 2976.1 MiB; starting swap 2508.8 MiB, maximum observed growth 0.0 MiB; elapsed 0.2 s; wrapper exit 0.
- **scoped-documents:** `git ls-files '*.py' '*.js' '*.mjs'` and `wc -l` (document/source inventory batch). Outcome: started at once; wait 0.0 s; MemAvailable admission 2814.6 MiB, final 2813.9 MiB; starting swap 2507.3 MiB, maximum observed growth 0.0 MiB; elapsed 0.2 s; wrapper exit 0.
- **baseline-backend:** `uv run --frozen pytest` (baseline, backend directory). Outcome: started at once; wait 0.0 s; MemAvailable admission 2826.9 MiB, final 2875.7 MiB; starting swap 2507.3 MiB, maximum observed growth 0.0 MiB; elapsed 7.3 s; wrapper exit 0.
- **baseline-frontend:** `node --test frontend/tests/*.test.js` (baseline). Outcome: started at once; wait 0.0 s; MemAvailable admission 2758.2 MiB, final 2616.3 MiB; starting swap 2499.3 MiB, maximum observed growth 0.0 MiB; elapsed 1.0 s; wrapper exit 0.
- **lint-baseline-comparison:** `ruff check --output-format json backend/app.py tools/check_tasks_md.py` and `ty check --output-format concise app.py` (each tree, sequentially). Outcome: started at once; wait 0.0 s; MemAvailable admission 2756.7 MiB, final 2769.1 MiB; starting swap 2441.8 MiB, maximum observed growth 0.0 MiB; elapsed 1.4 s; wrapper exit 0.
- **behavior-and-comment-audit:** `python3` (stdin audit of tracked source ASTs, comment diffs and preserved files). Outcome: started at once; wait 0.0 s; MemAvailable admission 2753.2 MiB, final 2752.9 MiB; starting swap 2441.3 MiB, maximum observed growth 0.0 MiB; elapsed 0.8 s; wrapper exit 0.
- **final-backend:** `uv run --frozen pytest` (edited tree, backend directory). Outcome: started at once; wait 0.0 s; MemAvailable admission 2690.9 MiB, final 2652.5 MiB; starting swap 2439.1 MiB, maximum observed growth 0.5 MiB; elapsed 3.9 s; wrapper exit 0.
- **final-frontend:** `node --test frontend/tests/*.test.js` (edited tree). Outcome: started at once; wait 0.0 s; MemAvailable admission 2532.0 MiB, final 2545.1 MiB; starting swap 2441.6 MiB, maximum observed growth 0.0 MiB; elapsed 1.2 s; wrapper exit 0.
- **local-startup-smoke:** `uv run --frozen uvicorn app:app --reload --host 127.0.0.1 --port <free-port>` (bounded smoke wrapper). Outcome: started at once; wait 0.0 s; MemAvailable admission 2697.2 MiB, final 2555.9 MiB; starting swap 2450.8 MiB, maximum observed growth 0.2 MiB; elapsed 3.8 s; wrapper exit 0.

### Final document validation

Six edited/new Markdown documents passed checks for reference definitions,
70 local file/heading targets, short single-line headings and a final
`Draft issues` review section. The original brief and other historical files
were preserved. `git diff --check` passed. An initial local link-check attempt
rejected a reference followed by a colon before a command block; that phrasing
was clarified and the check rerun successfully.

- **Document validation 1:** `python3` (stdin Markdown/link and preserved-file audit). Outcome: started at once; wait 0.0 s; MemAvailable admission 2732.6 MiB, final 2727.7 MiB; starting swap 2423.2 MiB, maximum observed growth 0.0 MiB; elapsed 0.2 s; exit 1.
- **Document validation 2:** `python3` (stdin Markdown/link and preserved-file audit). Outcome: started at once; wait 0.0 s; MemAvailable admission 2547.6 MiB, final 2546.9 MiB; starting swap 2423.4 MiB, maximum observed growth 0.0 MiB; elapsed 0.2 s; exit 0.

[documentation review]: ../reviews/2026-10-22-docs-review.md
[audio contract]: ../audio-contract.md
[development guide]: ../development.md
