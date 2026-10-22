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
