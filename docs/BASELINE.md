# Baseline — Sites v5

- Date: 31 October 2026.
- Project: SCL Lab — Edytor i symulator PLC.
- Source commit: `2ec9b76aaea5b3ceb689c7d4f1205d7a322d25b5`.
- Saved Sites version: **5**; matched to source through Sites version metadata.
- Source tree was clean before work.
- Tests rerun: **44 passed, 0 failed**.
- Independent archive: `SCL_Lab_backup_2026-10-31_v5.zip`.
- Archive SHA-256: `32613e5fc45aeccc07ce226e323348f148f0399535a2445eefe8991c63dba4b1`.
- Archive contains source, a Git bundle, checksums and the restoration test log.
- Restoration verified by cloning the bundle into a separate directory, checking out the baseline SHA and rerunning all 44 tests. There is no build step.
- Local references: `backup/pre-scl-history-2026-10-31` and `baseline-scl-v5-2026-10-31`.

## Existing behaviour

User programs, trash, one-block interpreter, scan/instruction stepping, breakpoint/watches, inline execution samples, simulated timers, selected standard functions, suggestions/snippets, formatting and adjustable workspace panels.

## Baseline limitations

Not a complete TIA compiler. No custom FC/FB execution, project UDT resolver, hardware/communication/Motion/safety runtime or Siemens-exact numeric implementation. Existing source groups parsing and runtime in one module. Current browser data is not part of the application-source archive.

The separate GitHub repository starts with an import of this exact application source. Its commit IDs differ from the Sites repository; the source SHA above records provenance, not a claim of identical Git history.
