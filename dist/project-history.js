// Whole-workspace snapshots. One localStorage write commits the current project
// and its recovery points together; legacy v3 data remains untouched.
export const HISTORY_KEY = 'scl-lab-history-v1';
let sequence = 0;
export const revisionId = () => globalThis.crypto?.randomUUID?.() || `rev-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
const clone = value => JSON.parse(JSON.stringify(value));
const own = (o, key) => Object.hasOwn(o, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateProject(value) {
  if (!record(value) || ![1, 2, 3].includes(value.version) || typeof value.code !== 'string') {
    throw Error('To nie jest plik projektu SCL Lab.');
  }
  for (const key of ['drafts', 'projectFiles']) {
    if (value[key] !== undefined && (!record(value[key]) || Object.values(value[key]).some(x => typeof x !== 'string'))) {
      throw Error('Nieprawidłowa lista programów w projekcie.');
    }
  }
  if (value.trash !== undefined && (!record(value.trash) || Object.values(value.trash).some(x => !record(x) || typeof x.code !== 'string' || typeof x.filename !== 'string'))) {
    throw Error('Nieprawidłowa zawartość kosza.');
  }
  for (const key of ['currentExample', 'filename', 'globals']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw Error('Nieprawidłowe pole projektu: ' + key);
  }
  if (value.watches !== undefined && (!Array.isArray(value.watches) || value.watches.some(x => typeof x !== 'string'))) throw Error('Nieprawidłowa lista obserwowanych.');
  if (value.breakpoints !== undefined && (!Array.isArray(value.breakpoints) || value.breakpoints.some(x => !Number.isInteger(x) || x < 1))) throw Error('Nieprawidłowe punkty przerwania.');
  for (const [key, allowed] of [['dt', [10, 20, 50, 100]], ['speed', [1, 4, 10]]]) {
    if (value[key] !== undefined && !allowed.includes(value[key])) throw Error('Nieprawidłowe ustawienie: ' + key);
  }
  return value;
}

function projectCopy(value) {
  validateProject(value);
  const {revisionHistory, ...project} = value;
  return clone(project);
}

export function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length > 500) throw Error('Nieprawidłowa historia projektu (maks. 500 wersji).');
  const ids = new Set();
  for (const entry of entries) {
    if (!record(entry) || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || typeof entry.label !== 'string' || entry.label.length > 160 || !Number.isFinite(entry.createdAt) || !['auto', 'manual'].includes(entry.kind)) {
      throw Error('Nieprawidłowy punkt historii projektu.');
    }
    validateProject(entry.project);
    if (own(entry.project, 'revisionHistory')) throw Error('Historia projektu nie może zawierać zagnieżdżonej historii.');
    ids.add(entry.id);
  }
  return entries;
}

// Sort IDs so switching files or changing object insertion order does not make
// a new code revision. Watch settings and simulated runtime are not code edits.
export function projectContent(value) {
  const p = projectCopy(value), drafts = {...p.drafts};
  drafts[p.currentExample || 'custom'] = p.code;
  const files = Object.keys(drafts).sort().map(id => [id, p.projectFiles?.[id] || (id === p.currentExample ? p.filename : '') || 'Program.scl', drafts[id]]);
  const trash = Object.entries(p.trash || {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({files, trash, globals: p.globals || '{}'});
}

export class ProjectHistory {
  constructor(storage, {key = HISTORY_KEY, autoLimit = 30, now = () => Date.now(), id = revisionId} = {}) {
    this.storage = storage;
    this.key = key;
    this.autoLimit = autoLimit;
    this.now = now;
    this.id = id;
    this.raw = storage.getItem(key);
    this.state = this.raw === null ? {format: 1, revision: 0, current: null, entries: []} : JSON.parse(this.raw);
    if (!record(this.state) || this.state.format !== 1 || !Number.isInteger(this.state.revision) || this.state.revision < 0) throw Error('Nie można odczytać historii. Zachowane dane nie zostały nadpisane.');
    if (this.state.current !== null) validateProject(this.state.current);
    validateEntries(this.state.entries);
  }

  current() { return clone(this.state.current); }
  entries() { return clone(this.state.entries); }

  save(project, {label = 'Edycja programu', checkpoint = false, kind = 'auto', imported = []} = {}) {
    const current = projectCopy(project);
    validateEntries(imported);
    if (!['auto', 'manual'].includes(kind)) throw Error('Nieprawidłowy rodzaj wersji.');
    if (this.storage.getItem(this.key) !== this.raw) throw Error('Projekt zmienił się w innej karcie. Pobierz swoją pracę i odśwież stronę, aby uniknąć nadpisania.');
    const next = clone(this.state);
    const push = (p, text, entryKind) => {
      // Repeated autosaves/blur/compile must not consume recovery points.
      const last = next.entries.at(-1);
      if (entryKind === 'auto' && last && JSON.stringify(last.project) === JSON.stringify(projectCopy(p))) return;
      next.entries.push({id: this.id(), createdAt: this.now(), label: String(text).trim().slice(0, 160) || 'Wersja projektu', kind: entryKind, project: projectCopy(p)});
    };
    if (next.current && projectContent(next.current) !== projectContent(current)) push(next.current, 'Przed: ' + label, 'auto');
    if (checkpoint) push(current, label, kind);
    const ids = new Set(next.entries.map(e => e.id));
    for (const entry of imported) if (!ids.has(entry.id)) { next.entries.push(clone(entry)); ids.add(entry.id); }
    next.entries.sort((a, b) => a.createdAt - b.createdAt);
    let automatic = next.entries.filter(e => e.kind === 'auto').length;
    next.entries = next.entries.filter(e => e.kind !== 'auto' || automatic-- <= this.autoLimit);
    if (next.entries.length > 500) throw Error('Historia jest pełna. Pobierz projekt z historią przed dalszą pracą.');
    next.current = current;
    next.revision++;
    const raw = JSON.stringify(next);
    // Failed writes keep both the old current project and recovery points.
    this.storage.setItem(this.key, raw);
    this.raw = raw;
    this.state = next;
    return this.current();
  }

  export(project) { return {...projectCopy(project), revisionHistory: {format: 1, entries: this.entries()}}; }
}

export function importedEntries(project) {
  if (!own(project, 'revisionHistory')) return [];
  if (!record(project.revisionHistory) || project.revisionHistory.format !== 1) throw Error('Nieobsługiwany format historii.');
  return validateEntries(project.revisionHistory.entries);
}

export function projectFilesForDiff(project) {
  const files = Object.assign(Object.create(null), project.drafts || {});
  files[project.currentExample || 'custom'] = project.code;
  return files;
}

// A bounded LCS avoids freezing the editor on very large sources. The fallback
// still shows all text; it simply does not find matches inside the changed span.
export function diffLines(before, after) {
  const a = before.split('\n'), b = after.split('\n');
  let prefix = 0, suffix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  const rows = a.slice(0, prefix).map(text => ({type: 'same', text}));
  const x = a.slice(prefix, a.length - suffix), y = b.slice(prefix, b.length - suffix);
  let simplified = x.length * y.length > 300000;
  if (simplified) {
    rows.push(...x.map(text => ({type: 'removed', text})), ...y.map(text => ({type: 'added', text})));
  } else {
    const table = Array.from({length: x.length + 1}, () => new Uint32Array(y.length + 1));
    for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    let i = 0, j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) { rows.push({type: 'same', text: x[i++]}); j++; }
      else if (i < x.length && (j === y.length || table[i + 1][j] >= table[i][j + 1])) rows.push({type: 'removed', text: x[i++]});
      else rows.push({type: 'added', text: y[j++]});
    }
  }
  if (suffix) rows.push(...a.slice(a.length - suffix).map(text => ({type: 'same', text})));
  let oldLine = 0, newLine = 0;
  for (const row of rows) { row.oldLine = row.type === 'added' ? null : ++oldLine; row.newLine = row.type === 'removed' ? null : ++newLine; }
  return {rows, simplified, added: rows.filter(r => r.type === 'added').length, removed: rows.filter(r => r.type === 'removed').length};
}
