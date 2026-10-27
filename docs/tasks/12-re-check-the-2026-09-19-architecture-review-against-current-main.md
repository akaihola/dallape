Steward issue, 2026-10-21 08:00 digest. Goal: music (dallape is a tier 3 project in `<steward-vault>/Goals.md`). Labelled `review` (steward decision D68). Estimated 1 h.

[The architecture review and remediation plan](../2026-09-19-architecture-review-and-remediation-plan.md) read `main` around `cc5b161`. Since then `main` has gained 50 commits (22 files, about 2,300 lines added outside the tracker), including the remediation issues that the steward accepted on 2026-10-21. Nobody has checked the review against today's code.

## What to do

1. Re-read the cited code for each ranked finding at current `main` and record that commit. Mark each finding open, changed or resolved, citing the commit or issue.
2. Review the code added since `cc5b161` for new findings, in the review's style and ranking. Apply the `honey` principles and the deep-module vocabulary of the `codebase-design` skill where they are installed; say so if one is missing. Cite files and lines.
3. Write the result as `docs/reviews/2026-10-21-architecture-recheck.md`: the commit checked, every earlier finding with its status, the new findings, and "Do these three first".
4. Under a final "Draft issues" heading, draft one issue per new or still-open finding worth doing: title, why, what to change, acceptance. Don't file them; the steward does. Leave out any that an open issue already covers, and name that issue.

## Constraints and acceptance

- Documentation only: no code, test or tracker changes besides this issue's own moves.
- Memory: before each command, wait up to 10 minutes for `MemAvailable` of at least 2 GiB; if it doesn't come, start the command anyway when at least 1.5 GiB is available. Stop a running command when `MemAvailable` falls below 1 GiB or swap grows by more than 512 MiB. Run one heavy command at a time, and bound any background job you start.
- The report names the commit it was checked against, and every earlier finding has a status.
