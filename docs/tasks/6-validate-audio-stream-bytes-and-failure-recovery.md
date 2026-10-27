---
depends-on: [4]
---

# Validate audio stream bytes and failure recovery

Steward proposal from HAI-3, 2026-10-19. Goal: music; dallape is tier 3. Promotion and implementation remain for the steward to choose.

See [the architecture review](../2026-09-19-architecture-review-and-remediation-plan.md#status-2026-10-19), remediation step 3.

Original step 3, F3, plus the original malformed-input observation. The range loop still advances by requested bytes without validating responses.

## Acceptance criteria

- Fault fixtures cover correct 206, ignored-range 200, wrong Content-Range/start, short/oversized responses, 403/416, failures before first byte and midstream, unknown size and disconnect.
- Every case returns exact bytes or an explicit failure, never silent duplication/skips; retries are bounded and resume only at verified offsets, or fail clearly.
- Establish upstream readiness before success headers where practical; close and sanitize logs on failures after response start. Known expected lengths must match before the client enables downloads.
- Test actual Uvicorn HTTP framing as well as in-process behavior, upstream handle closure and deadline/cancellation cleanup.
- Malformed URL authorities return 400 rather than an uncaught ValueError; add frontend/backend malformed-input parity fixtures without a shared schema generator.
- Document parameters, errors, partial-stream behavior and the absence of a client Range/resume promise; retain endpoint/query compatibility.

## Implementation evidence, 2026-10-19

- Each upstream response validates status, encoding, range and declared/actual
  length. Offsets advance only after verified EOF. Ignored ranges fail explicitly;
  automatic retry count is zero. The last block is withheld until validation.
- Initial readiness is checked before success headers. Later failures break HTTP
  framing and suppress upstream exception details. Upstream handles close on
  success, errors, deadline checks and disconnect, including cancellation during
  an active worker read. Socket inactivity is bounded to 10 seconds. The 840-second
  budget is checked between reads; it does not interrupt a continuously trickling
  blocking read. Hard wall-clock work limits remain relevant to HAI-8.
- The browser checks known Content-Length before enabling a Blob download and
  cancels the reader on failure. Failed tracks retain click-to-retry behavior.
- Independently maintained frontend/backend malformed-authority cases cover
  invalid brackets, ports, credentials, schemes and Unicode authority separators.
- README documents query compatibility, errors, partial-stream behavior and the
  absence of client Range/resume support.

Validation: backend `uv run pytest -q` passes 62 tests and covers fault fixtures and actual Uvicorn
HTTP framing with known and unknown sizes, disconnect and handle cleanup.
Frontend `node --test frontend/tests/*.test.js` passes 19 tests and covers length mismatch and retry
alongside lifecycle regressions. `git diff --check` passes. Production deployment
and live YouTube playback were not exercised.
