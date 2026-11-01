# SCL IDE interface audit

Date: 2026-10-31. Scope: workspace chrome and surrounding controls. The editor, completion, folding adapter and interpreter implementation were not changed.

## Changes

- Rename the product to SCL IDE, including page title, help and exported filenames. Keep existing browser storage keys and JSON formats for compatibility.
- Remove the SANDBOX badge, PLC Playground label, obsolete version footer, duplicate help link and redundant current-page tab.
- Keep simulation controls, history, inline-value toggle, check and export visible. Put secondary editor commands in Tools and font/autoformat in Settings.
- Apply consistent dark chrome, clearer selected buttons, focus outlines and popup menus. Preserve the code rendering and typography.
- Fix speed persistence and panel opening from focus mode. Make the file sidebar accessible at tablet widths.
- Use collision-resistant IDs for created/restored/imported programs.
- Reject falsy JSON documents as invalid projects before changing the workspace.

## Verification

`npm test`: **100 passed, 0 failed**. Eight new regressions cover focus/panel transitions, setting reloads, corrupt layout input, keyboard resizing, dialog shortcut isolation, storage write failure, invalid JSON and valid project round-trip. Existing tests cover project history migration, quota failure, cross-tab conflict, imports and trash recovery.

Manual checks in the managed Chrome preview at 1363 × 936:

| Workflow | Observed result |
| --- | --- |
| Help and function list | Open and close successfully |
| Tools / Settings | Open, close outside, close with Escape; settings controls available |
| Settings after reload | Font, autoformat, cycle duration and speed restored |
| Panels / focus | File and variable panels open from focus and exit focus |
| Test program | Added as a separate file without replacing existing files |
| Run / pause / instruction / cycle / reset | Labels and scan/time metrics update; reset returns scans to zero |
| BOOL pulse | Input returns to FALSE; test outputs include FOR=55, WHILE=15, REPEAT=10 |
| Watches / filter / trace tab | Add watches via button and form; count and filter update; trace panel opens |
| Console | Opens and clears the log count |
| Variable form | Adds a BOOL input and closes after success |
| DB data | JSON applied and program checks successfully |
| History | Named version appears, comparison renders, restore confirmation cancels |
| Programs | Create, switch, move to trash and restore |
| Empty trash / recovery | Trash empties; named pre-empty checkpoint restores its contents |

## Limits

- The managed download API reported a failed project download and timed out for SCL export. The file chooser API also timed out. Disk downloads and end-to-end browser import/export round-trip are **unverified**, not a passed check. Project serialization/import validation is covered by automated tests.
- Touch devices, mobile viewports, pointer dragging and other browser engines were not manually verified. Keyboard resizing is exercised automatically. No claim of exhaustive accessibility or cross-browser acceptance.
- A stale preview caused a genuine storage conflict warning during QA. Reloading restored access and the declaration check then succeeded; the app correctly refused the stale write.
- Trace tab opening was checked; waveform pixel accuracy was not inspected.

## Backup and rollback

Before-change GitHub reference: `851a35135a95049e0c51c8a953a63a4dd5f3788b`, branch `backup/pre-scl-ide-ui-2026-10-31`. An independent source checkpoint with Git bundle and checksums was also made before edits. The previous hosted version is version 9.

Revert this feature commit or redeploy the saved version 9 to roll back the application. Browser programs are not part of a source backup; retain exported project JSON separately. No storage-key migration is required by this change.
