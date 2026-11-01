# M2 parser regressions — first increment

Base: `a746d2969a34473bc6d4bc99c9bf1b1086fb7fd9`.

## Changes

- CASE label lookahead parses a label list speculatively and restores the cursor. It no longer searches for a colon inside nested statements or imposes a 30-token label limit.
- Radix literals reject digits outside their base; numeric literal prefixes cannot silently consume part of an invalid token.
- Explicit FUNCTION, FUNCTION_BLOCK and ORGANIZATION_BLOCK headers require their matching terminator. Raw program bodies remain supported.

## Validation

Baseline: 44 passing tests. Added 20 regression cases; 12 failed before the patch. Result: 64 passing, 0 failing.
The new tests cover nested CASE execution and AST arm boundaries, nested loops, signed labels, long lists, malformed literals, terminator mismatches and raw-body compatibility.

## Remaining work

This is the first M2 increment, not completion of the language-service roadmap. Source ranges, tolerant recovery, static member/type diagnostics, DB/UDT resolution and user FC/FB execution remain pending. No TIA/PLCSIM reference validation was performed. No hosting deployment is included.

## Recovery

Before changes, the checkpoint script saved all 30 reconstructed baseline source files, a local snapshot Git bundle and checksums outside the checkout. The local snapshot history is not a clone of upstream history. Upstream baseline is preserved by `backup/pre-parser-m2-2026-11-01`.
To undo this patch after acceptance, revert its commit; do not reset a shared branch. Application-source backups do not contain browser-local user programs.

