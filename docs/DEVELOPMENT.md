# Development and recovery

## Branches and review

- `main`: accepted baseline / milestones.
- `backup/pre-<stage>-<date>`: immutable starting reference for a milestone.
- `feat/<scope>` or `fix/<scope>`: one reviewable change.
- Each PR states the problem, resulting behaviour, test results, known limits and rollback reference.
- Leave feature PRs open for review. Do not automatically merge or enable auto-merge.
- Sites hosting and GitHub are separate remotes. Source pushes to GitHub do not by themselves deploy the Site. Record exact commits when delivering an updated Site for testing.

## Before changing application behaviour

```sh
git status --short
node scripts/checkpoint.mjs ../automation-ide-backups M1-before-history
git switch -c feat/your-scope
```

The checkpoint script copies tracked files **and non-ignored untracked files**, including uncommitted changes, into an independent directory. It also creates a Git bundle and SHA-256 manifest. It refuses known secret filenames and an output directory inside the checkout. Review any other confidential source before uploading it.

A Git tag or branch alone does not capture uncommitted files. Keep the independent checkpoint outside the repository and retain older checkpoints.

## Validation

```sh
npm test
```

For UI changes, serve `dist/` over HTTP and check editing, saving, reload, export/import and the changed workflow. Use the same SCL fixtures for before/after comparisons. Tests do not replace reference compilation in TIA Portal.

## Restore a source checkpoint

Work in a **new directory**. Copy checkpoint `source/`, run `npm test` and serve its `dist/`. To recover history, `git clone path/to/history.bundle restored-repo` and check out the recorded SHA. Uncommitted content exists in `source/`, not in the Git bundle. Do not use destructive reset or force-push to roll back a shared branch; use a revert commit or a new branch from the known good version.

## Restore a user's project

Download a project JSON before replacing browser data. Use History to inspect an earlier snapshot and restore the whole project; the previous workspace is retained as a recovery point. Export includes the retained history. Browser-local history disappears if site storage is cleared, so keep the downloaded JSON outside the browser.

## Description style

Follow the author's existing repositories: English README, direct purpose statement, concrete feature lists, local-run instructions, data/recovery behaviour and test limitations. Small emoji headings help scanning. Use concise English commit/PR titles; do not inflate implemented support or claim planned work is complete. Product labels remain Polish.
