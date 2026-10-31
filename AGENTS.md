# Automation IDE working rules

- Develop SCL milestones first. VBScript / WinCC is deferred until SCL acceptance.
- Read `docs/ROADMAP.md` and `docs/ARCHITECTURE.md` before architecture changes.
- Before each application change set, verify the current source and create an independent source checkpoint outside the repo. Preserve uncommitted work as well as Git history. Never overwrite an older checkpoint.
- Work in a focused feature/fix branch. Record the before-change reference, tests, limitations and rollback in the PR. Leave feature PRs open for the user's review; no auto-merge.
- Preserve the existing interpreter and debugger while extracting interfaces. Keep editor migrations and parser/runtime changes in separate milestones.
- Run the existing test suite and meaningful regressions for changed behaviour. For state/storage changes include failed writes, migration, round-trip and recovery.
- User programs stay in browser storage. Application-source backups do not contain those programs. Keep JSON import/export backward compatible and validate before replacing state.
- Never declare full TIA V20 compatibility without reference tests. Report parsed/resolved/executable support separately.
- Follow the existing author's concise English GitHub descriptions; keep product UI in Polish.
- Do not expose credentials or browser data in source, logs, commits or archives. Sites credentials are ephemeral and are not GitHub credentials.
