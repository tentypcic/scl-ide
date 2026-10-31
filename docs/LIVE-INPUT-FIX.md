# Live simulation inputs

Date: 2026-10-31. Focused fix for editing simulation values while Run is active.

## Cause

The scan render recreated all variable, watch and I/O controls using innerHTML approximately every 80 ms. Replacing a button between pointerdown and pointerup prevents the original click from reaching its handler. It also drops keyboard focus. The old input-focus workaround froze a whole panel while a number was being edited.

The managed Chrome reproduction used a real 240 ms pointer press on Start during Run. Before the fix Start remained FALSE; after the fix the same interaction changed it to TRUE.

## Change

`live-controls.js` reconciles generated control markup while preserving element identity for the same variable/action/type. Values, labels and classes update without replacing the button. An active text input keeps its draft, default value and selection while other values continue to refresh. Changed variables/types and removed rows still replace/remove the appropriate elements.

Value editing has a reentrancy guard: Enter and its synchronous blur/change event write once. Escape cancels without writing, including when blur emits change. Invalid values report an error and retain the runtime value. The interpreter and PLC scan semantics are unchanged.

## Verification

- **132 tests pass**, including 9 new regressions for control identity, draft/caret retention, live value refresh, changed identities/types, structural removal, single commit, cancellation, rejection and pending edit flush.
- Managed Chrome, Run active throughout interaction: 240 ms BOOL press; BOOL keyboard Space in variables and watches; INT 12 produces output 24; TIME T#250ms accepted; Escape restores 12 after drafting 99.
- A numeric draft survived hundreds of scans while other values refreshed.
- A 240 ms press on the one-cycle pulse control resulted in exactly one execution of `IF #Start THEN #Impulsy := #Impulsy + 1; END_IF;`; Start returned to FALSE and Run remained active.
- Normal pause/run controls and recompilation still worked in the same scenario.

These are ordinary runtime writes: a subsequent SCL assignment to the same variable can change it again. Continuous force, scan-boundary input scheduling, hardware I/O and complete PLC semantics are not introduced here. Browser QA was performed in managed Chrome; other browser engines, touch/IME and mobile acceptance remain unverified.

## Backup and rollback

Before-change GitHub commit: `530cd9d2e4c59520f9055b2c9664ab83e3d83179`; backup branch `backup/pre-live-input-fix-2026-10-31`. Before-change Sites commit: `17bf687876cf59b8724715bda4e43987b22ff203`, saved version 11. An independent source checkpoint with checksums and Git bundle was created before edits.

Revert this patch or redeploy saved version 11. No browser storage keys or project formats changed. Source backups do not contain browser-stored user programs.
