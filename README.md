# SCL IDE

<p align="center">
  Browser-based <strong>SCL editor + PLC simulator</strong><br />
  Built with plain <strong>HTML + CSS + JavaScript</strong>, without runtime dependencies.<br />
  <a href="https://scl-lab-magnesy.tentypcic.chatgpt.site">Open SCL IDE</a> ·
  <a href="https://github.com/tentypcic/automation-ide/issues">Report Bug</a> ·
  <a href="docs/ROADMAP.md">Roadmap</a>
</p>

---

## 🧠 About The Project

**SCL IDE** (repository: Automation IDE) is a browser workspace for writing, analysing and testing Siemens SCL before checking it in TIA Portal.

The first goal is a dependable **SCL workflow**: useful suggestions while typing, clear diagnostics, visible values during execution and recoverable project changes. A separate VBScript / WinCC Comfort / Runtime Advanced adapter is planned **after the SCL milestones**.

This is an interpreter for a documented subset of SCL. It does not compile PLC machine code or provide full TIA Portal V20 compatibility.

## 🛠 Features

- 📁 **Programs** — create, import, export, delete to trash, restore and empty trash with a named recovery snapshot.
- ✏️ **Editor** — syntax colours, suggestions after one letter, structure members, IF / CASE / FOR snippets, indentation, formatting and nested IF / FOR / WHILE / REPEAT / CASE / REGION / VAR / STRUCT folding. Completion covers all 63 current functions, 29 accepted types and all declaration sections.
- ▶️ **Simulation** — cyclic execution, editable inputs, typed variables, arrays, inline structures and simulated timers.
- 🐞 **Debugger** — instruction / scan stepping, breakpoints, watches, execution-time inline values and signal traces.
- 💾 **Local project data** — JSON import/export and browser storage.
- ◷ **Project history** — automatic recovery points, named versions, line comparison and whole-project restoration. JSON exports include retained history.

The surrounding workspace uses compact tool/settings menus, keyboard-accessible panels and a recoverable trash workflow. See [the interface audit](docs/INTERFACE-AUDIT.md).

See [the roadmap](docs/ROADMAP.md) for implementation status and acceptance criteria. Planned items are not an assurance of existing language support.

## 🚀 Getting Started

Requirements: Node.js 22 or newer for tests; a modern browser and a static HTTP server for the app. There is no package installation or build step.

```sh
git clone https://github.com/tentypcic/automation-ide.git
cd automation-ide
npm test
```

Serve **`dist/`** using a static HTTP server, for example `python3 -m http.server 8080 --directory dist`, then open `http://localhost:8080`. Browser module imports require HTTP; opening the HTML as `file://` is not supported.

1. Create or open an SCL program, or choose **Kod testowy SCL** in the Files panel.
2. Check the code and set inputs.
3. Run, or use **F10** for one instruction and **Shift+F10** for one PLC scan.
4. Download a project JSON to keep a separate copy of your work.

The hosted SCL IDE currently requires its owner's ChatGPT access. A private repository does not make that hosted page public.

## 📂 Project Structure

| Path | Purpose |
| --- | --- |
| `dist/app.js` | Workspace UI and simulation controls |
| `dist/engine.js` | Existing parser and interpreter |
| `dist/assist-core.js`, `dist/assist.js` | Editor suggestions and snippets |
| `dist/formatter.js` | SCL indentation |
| `dist/folding-core.js`, `dist/code-folding.js` | Structural folding, full-source/view mapping and editor adapter |
| `dist/project-history.js`, `dist/history-panel.js` | Atomic history storage, line diff and recovery UI |
| `dist/debug-values.js`, `dist/inline-monitor.js` | Execution samples and inline display |
| `tests/` | Node.js regression tests |
| `docs/` | Architecture, milestones, baseline and recovery |
| `scripts/checkpoint.mjs` | Independent source checkpoint before a change |

## 💾 Data and Recovery

Programs stay in browser storage for the current origin. They do not sync to GitHub or other devices. Clearing browser data can remove saved programs and history; download project JSON regularly. GitHub protects **application source**, not the programs written in a user's browser.

History records the previous saved workspace after an 800 ms pause in editing, with separate checkpoints before formatting, import, deletion and restore. Keep 30 latest automatic points plus named versions. Restore replaces the whole project and resets simulation, retaining the previous workspace first. Storage failures are reported; conflict checks help stop stale tabs overwriting newer saves, but are not a simultaneous multi-tab transaction.

Every development milestone starts from an independent source checkpoint, uses a focused branch, and ends with tests and a reviewable pull request. See [development and recovery](docs/DEVELOPMENT.md).

## 🧪 Tests and Compatibility

```sh
npm test
```

The current suite passes **123 tests**, including workspace transitions, persistence, import validation and 23 parser audit regressions. Coverage checks exercise completion templates against all 63 executable functions, all 29 accepted types and all seven declaration sections. GitHub Actions runs the suite on feature/fix pushes and pull requests. Tests cover the implemented interpreter, assistance, formatter, debugger, project history and folded editing; they do not establish complete Siemens compatibility. See [the baseline](docs/BASELINE.md), [M1 validation](docs/M1-HISTORY.md), [folding validation](docs/CODE-FOLDING.md) and [the parser audit](docs/M2-PARSER-AUDIT.md).

Current limits include one executed block / instance; no user FC/FB calls or project UDT resolver; no hardware, Motion Control, communication, safety instructions or full Siemens numeric semantics. Timers use simulation time. TIA Portal / PLCSIM remain the reference for exported SCL.

## 🧑‍💻 Author

Created by [tentypcic](https://github.com/tentypcic).

This repository is private while the initial architecture and SCL milestones are being developed. No open-source licence is granted at this stage.
