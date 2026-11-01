import test from 'node:test';
import assert from 'node:assert/strict';
import {ProjectHistory, HISTORY_KEY, projectContent, diffLines, validateProject, importedEntries} from '../dist/project-history.js';

const project = (source = '#x := 1;') => ({version: 3, currentExample: 'user_1', filename: 'Test.scl', code: source, drafts: {user_1: source}, projectFiles: {user_1: 'Test.scl'}, trash: {}, globals: '{}', watches: [], breakpoints: [], dt: 20, speed: 1});
const storage = () => {const data = new Map(); return {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data};};
const history = (s = storage(), options = {}) => {let i = 0; return new ProjectHistory(s, {now: () => ++i, id: () => 'id-' + i++, ...options});};

test('edits preserve previous workspace and survive reloading without touching legacy data', () => {
  const s = storage(); s.setItem('scl-lab-project-v3', 'legacy'); const h = history(s);
  h.save(project('old')); h.save(project('new'));
  assert.equal(h.entries()[0].project.code, 'old');
  assert.equal(history(s).current().code, 'new');
  assert.equal(s.getItem('scl-lab-project-v3'), 'legacy');
});
test('quota failure keeps previous current and snapshots together', () => {
  const s = storage(), h = history(s); h.save(project('old')); const raw = s.getItem(HISTORY_KEY);
  s.setItem = () => {throw Error('quota');};
  assert.throws(() => h.save(project('new')), /quota/);
  assert.equal(h.current().code, 'old'); assert.equal(s.getItem(HISTORY_KEY), raw); assert.deepEqual(h.entries(), []);
});
test('another tab cannot overwrite a newer saved workspace', () => {
  const s = storage(), first = history(s); first.save(project()); const second = history(s);
  first.save(project('newer')); assert.throws(() => second.save(project('stale')), /innej karcie/);
  assert.equal(history(s).current().code, 'newer');
});
test('autosave ignores file switching, watch edits, reordering and repeated checkpoints', () => {
  const h = history(); const p = project(); p.drafts.other = 'other'; p.projectFiles.other = 'Other.scl';
  h.save(p); h.save({...p, watches: ['#x']});
  h.save({...p, currentExample: 'other', filename: 'Other.scl', code: 'other', drafts: {other: 'other', user_1: p.code}});
  assert.equal(h.entries().length, 0);
  h.save(p, {checkpoint: true, label: 'Przed formatowaniem'}); h.save(p, {checkpoint: true});
  assert.equal(h.entries().length, 1);
});
test('retention bounds automatic entries and preserves named versions', () => {
  const h = history(storage(), {autoLimit: 2});
  h.save(project('baseline'), {checkpoint: true, kind: 'manual', label: 'Działający program'});
  for (let n = 0; n < 5; n++) h.save(project(String(n)));
  assert.equal(h.entries().filter(e => e.kind === 'auto').length, 2);
  assert.equal(h.entries().find(e => e.kind === 'manual').project.code, 'baseline');
});
test('restoring records current unsaved work and supports undo by another restore', () => {
  const h = history(); h.save(project('baseline'), {checkpoint: true, kind: 'manual', label: 'Baza'});
  const baseline = h.entries()[0]; h.save(project('work in progress'));
  h.save(baseline.project, {label: 'Przywrócenie wersji'});
  assert.equal(h.current().code, 'baseline');
  const recovery = h.entries().find(e => e.project.code === 'work in progress'); assert.ok(recovery);
  h.save(recovery.project); assert.equal(h.current().code, 'work in progress');
});
test('export/import round trip includes history and validates it before writing', () => {
  const h = history(); h.save(project('old')); h.save(project('new'));
  const exported = JSON.parse(JSON.stringify(h.export(project('new'))));
  const s = storage(), imported = history(s); imported.save(exported, {imported: importedEntries(exported)});
  assert.deepEqual(imported.entries(), h.entries()); assert.equal(imported.current().code, 'new');
  assert.equal(Object.hasOwn(imported.current(), 'revisionHistory'), false);
  assert.throws(() => importedEntries({...exported, revisionHistory: {format: 1, entries: [{id: 'bad'}]}}));
  assert.equal(imported.current().code, 'new');
});
test('invalid imports and corrupted storage are preserved rather than silently replaced', () => {
  for (const extra of [{drafts: {bad: 1}}, {trash: {bad: null}}, {dt: -1}, {breakpoints: ['x']}, {watches: [1]}]) assert.throws(() => validateProject({...project(), ...extra}));
  const s = storage(); s.setItem(HISTORY_KEY, '{broken'); assert.throws(() => history(s)); assert.equal(s.getItem(HISTORY_KEY), '{broken');
});
test('project content includes delete, trash and DB edits and does not mutate its input', () => {
  const p = project(), before = JSON.stringify(p);
  assert.notEqual(projectContent(p), projectContent({...p, globals: '{"DB":{"x":1}}'}));
  assert.notEqual(projectContent(p), projectContent({...p, trash: {deleted: {code: 'old', filename: 'Old.scl'}}}));
  assert.equal(JSON.stringify(p), before);
});
test('explicit recovery checkpoints retain latest watch/settings even with identical source', () => {
  const h = history(); h.save(project(), {checkpoint: true, kind: 'manual', label: 'Baza'});
  const withSettings = {...project(), watches: ['#Wynik'], dt: 50};
  h.save(withSettings, {checkpoint: true, label: 'Przed przywróceniem'});
  h.save(project());
  assert.deepEqual(h.entries().at(-1).project.watches, ['#Wynik']);
  assert.equal(h.entries().at(-1).project.dt, 50);
});
test('line diff reconstructs both originals, including blank lines and HTML text', () => {
  for (const [a, b] of [['a\nb\nc', 'a\nB\nc\nd'], ['', 'x\n'], ['<script>\n\na', '\n<script>\na'], ['same', 'same'], ['a\nb', '']]) {
    const d = diffLines(a, b);
    assert.equal(d.rows.filter(r => r.type !== 'added').map(r => r.text).join('\n'), a);
    assert.equal(d.rows.filter(r => r.type !== 'removed').map(r => r.text).join('\n'), b);
    assert.equal(d.rows.filter(r => r.type === 'added').length, d.added);
  }
});
test('large line diff uses bounded fallback while retaining all source text', () => {
  const a = Array.from({length: 600}, (_, n) => 'old' + n).join('\n'), b = Array.from({length: 600}, (_, n) => 'new' + n).join('\n');
  const d = diffLines(a, b); assert.equal(d.simplified, true); assert.equal(d.removed, 600); assert.equal(d.added, 600);
});
test('empty trash preserves active code and creates a named recovery of all removed programs', () => {
  const h = history(storage(), {autoLimit: 1});
  const p = {...project(), trash: {a: {filename: 'A.scl', code: 'A'}, b: {filename: 'B.scl', code: 'B'}}};
  h.save(p);
  const pending = {...p, code: 'unsaved edit', watches: ['#x']};
  const next = h.emptyTrash(pending);
  assert.deepEqual(next.trash, {}); assert.equal(next.code, 'unsaved edit');
  assert.deepEqual(next.drafts, p.drafts); assert.deepEqual(next.watches, ['#x']);
  const recovery = h.entries().find(e => e.label === 'Przed opróżnieniem kosza');
  assert.equal(recovery.kind, 'manual'); assert.deepEqual(recovery.project.trash, p.trash);
  assert.equal(recovery.project.code, 'unsaved edit');
  for (let i = 0; i < 4; i++) h.save({...next, code: String(i)});
  assert.ok(h.entries().some(e => e.id === recovery.id));
  h.save(recovery.project); assert.deepEqual(h.current().trash, p.trash);
});
test('failed trash write leaves removed programs and history unchanged; empty trash is a no-op', () => {
  const s = storage(), h = history(s); h.save(project());
  const empty = s.getItem(HISTORY_KEY); h.emptyTrash(project()); assert.equal(s.getItem(HISTORY_KEY), empty);
  const p = {...project(), trash: {a: {filename: 'A.scl', code: 'A'}}}; h.save(p);
  const before = s.getItem(HISTORY_KEY), entries = h.entries(); s.setItem = () => {throw Error('quota');};
  assert.throws(() => h.emptyTrash(p), /quota/);
  assert.deepEqual(h.current().trash, p.trash); assert.deepEqual(h.entries(), entries); assert.equal(s.getItem(HISTORY_KEY), before);
});
