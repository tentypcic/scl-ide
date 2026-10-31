# M1 — Project history and recovery

Writing or importing a program previously replaced the only current browser copy. M1 adds recoverable workspace versions and an explicit comparison before restoration.

## Behaviour

- The **Historia** button opens version names/timestamps and a line diff against the current project.
- Save a named version, select another program or DB JSON to compare, then restore the whole project after reviewing its scope.
- Autosave preserves the previous saved workspace after 800 ms typing idle. Additional checkpoints protect formatting, declaration insertion, importing, deleting and restoring.
- Restoration first saves pending editor work and a recovery snapshot. It restores all programs, trash, watches, breakpoints and stored settings, and resets simulated memory/time.
- Export includes retained history; legacy project JSON remains importable.
- Retain 30 latest automatic versions plus named versions (up to 500 total, subject to browser quota). Named versions are not automatically evicted.
- A single envelope write stores current project and snapshots atomically. Failed writes retain the earlier envelope and show an unsaved/error status. Corrupted data is not silently replaced; raw data can be downloaded.
- Legacy v1/v2/v3 storage keys are preserved. A newly created envelope takes precedence on next load.

## Validation

- `npm test`: **56 passed, 0 failed** — 44 existing + 12 new.
- New tests cover write failures, migration/reload, stale writers, duplicate suppression, automatic retention, named snapshots, restore/undo, JSON round trip, invalid imports, corrupt data, metadata recovery and bounded diff.
- Browser smoke: named version; diff from `Wynik := 1` to `Wynik := 2`; restore to 1 while keeping 2 recoverable; reload persistence; execute restored code (output 1); legacy JSON import with a pre-import recovery point.
- Static JavaScript syntax and whitespace checks passed.

## Limits

- Local history is not an independent backup and does not sync between devices/origins. Download JSON separately.
- Autosave groups typing, rather than recording every keystroke.
- Compare-and-write plus storage events provide best-effort stale-tab detection; localStorage has no multi-tab transaction. Concurrent tabs can still race.
- The diff is textual, not an AST/semantic comparison. Large changed spans use a bounded fallback; UI renders at most 2500 rows, while exports retain all text.
- Restore acts on the whole project. Simulation state and input values are not persisted in history.
- No parser/runtime language changes are part of M1.

## Source backup / rollback

GitHub before-change branch: `backup/pre-scl-history-2026-10-31` (baseline import).

Independent verified baseline archive: `SCL_Lab_backup_2026-10-31_v5.zip`, SHA-256 recorded in `BASELINE.md`. A further source checkpoint was produced while developing the milestone, including uncommitted files and a verified Git bundle.

For source rollback, branch from the backup or revert the M1 commit. Before running the old application version, export a project JSON from the new version: old v5 does not read the new history envelope. Its preserved legacy key can contain an older project. Import the exported JSON in v5 to recover the current source (v5 ignores the extra history field).
