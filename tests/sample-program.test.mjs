import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from '../dist/engine.js';
import {withTestProgram} from '../dist/project-actions.js';

const source = readFileSync(new URL('../dist/FB_TestSCL.scl', import.meta.url), 'utf8');
function run(mode = 1, value = 7) {
  const m = compile(source, {dt: 20, globals: {}});
  m.input('Tryb', mode); m.input('WartoscTestowa', value); m.input('Start', true);
  for (let n = 0; n < 100 && !m.locals.Gotowe; n++) m.scan();
  assert.equal(m.locals.Gotowe, true);
  return m;
}

for (const [mode, expected] of [[1, 80], [2, 110], [3, 45], [9, -1]]) {
  test('shipped SCL sample completes mode ' + mode + ' with correct loops, text, bits and REAL results', () => {
    const m = run(mode);
    for (const [key, value] of Object.entries({SumaFOR: 55, SumaWHILE: 15, SumaREPEAT: 10, SumaBY: 30, SumaExitContinue: 12, Parzyste: 5, WynikCASE: expected, WynikREAL: 27.5, Znormalizowana: 0.5, Przeskalowana: 50, Tekst: 'ABC-OK', PozycjaTekstu: 5, Bity: 16, Krok: 40, Zajety: false})) assert.equal(m.locals[key], value, key);
    for (let i = 1; i <= 10; i++) {assert.equal(m.read(`#Dane[${i}].Liczba`).v, i); assert.equal(m.read(`#Dane[${i}].Parzysta`).v, i % 2 === 0);}
  });
}
test('sample IF branches, reset/restart edge and stop while timer is waiting', () => {
  for (const [value, expected] of [[15, 2], [7, 1], [0, 0], [-5, 0]]) assert.equal(run(1, value).locals.OcenaIF, expected);
  const m = run();
  m.input('Reset', true); m.scan(); assert.equal(m.locals.Krok, 0); assert.equal(m.locals.Gotowe, false);
  m.input('Reset', false); m.scan(); assert.equal(m.locals.Krok, 0); // Held Start must not restart.
  m.input('Start', false); m.scan(); m.input('Start', true); m.scan(); m.input('Start', false); m.scan();
  assert.equal(m.locals.Krok, 20); assert.equal(m.locals.Gotowe, false);
  m.scan(); assert.equal(m.locals.Opoznienie.Q, false);
  m.input('Stop', true); m.scan(); assert.equal(m.locals.Krok, 0); assert.equal(m.locals.Zajety, false); assert.equal(m.locals.Opoznienie.Q, false);
  assert.equal(m.locals.SumaFOR, 55); // Results deliberately remain available for comparison.
});
test('loading sample preserves pending user code, other programs, trash and DB data', () => {
  const p = {version: 3, currentExample: 'own', filename: 'Own.scl', code: 'pending edit', drafts: {own: 'old save', other: 'other code'}, projectFiles: {own: 'Own.scl', other: 'Other.scl'}, trash: {deleted: {filename: 'Old.scl', code: 'old'}}, globals: '{"DB":{}}', watches: ['#x'], breakpoints: [2]};
  const before = JSON.stringify(p), next = withTestProgram(p, source, 'sample');
  assert.equal(next.drafts.own, 'pending edit'); assert.equal(next.drafts.other, 'other code');
  assert.deepEqual(next.trash, p.trash); assert.equal(next.globals, p.globals);
  assert.equal(next.code, source); assert.equal(next.currentExample, 'sample'); assert.equal(next.filename, 'FB_TestSCL.scl');
  assert.deepEqual(next.watches, []); assert.deepEqual(next.breakpoints, []); assert.equal(JSON.stringify(p), before);
  assert.throws(() => withTestProgram(p, source, 'own'), /już istnieje/);
  assert.throws(() => withTestProgram(p, ''), /odczytać/);
});
