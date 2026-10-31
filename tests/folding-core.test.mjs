import test from 'node:test';
import assert from 'node:assert/strict';
import {FoldDocument, foldRanges, maskSCL} from '../dist/folding-core.js';
import {compile} from '../dist/engine.js';

const nested = 'REGION Main\nIF #a THEN\nFOR #i := 1 TO 2 DO\n#x := #x + 1;\nEND_FOR;\nELSE\n#x := 5;\nEND_IF;\nEND_REGION\n#y := #x;';
test('nested IF/FOR/REGION ranges are matched independently, with ELSE inside IF', () => {
  assert.deepEqual(foldRanges(nested).map(r => [r.kind, r.start, r.end]), [['REGION', 1, 9], ['IF', 2, 8], ['FOR', 3, 5]]);
  const d = new FoldDocument(nested); d.toggle(3); d.toggle(2);
  assert.deepEqual(d.visibleLines, [1, 2, 9, 10]);
  d.toggle(2); assert.deepEqual(d.visibleLines, [1, 2, 3, 6, 7, 8, 9, 10]);
  assert.equal(d.source, nested);
});
test('comments, escaped strings, quoted symbols and REGION titles do not invent folds', () => {
  const source = `// IF\n(* FOR\n (* IF *) END_FOR *)\n"IF" := 'CASE $' END_CASE';\n#s := 'REPEAT '' END_REPEAT';\nREGION CASE IF FOR\n#x := 1;\nEND_REGION\n/* WHILE\nEND_WHILE */`;
  assert.deepEqual(foldRanges(source).map(r => r.kind), ['REGION']);
  assert.equal(maskSCL(source).length, source.length);
  assert.equal(maskSCL(source).split('\n').length, source.split('\n').length);
});
test('WHILE, REPEAT and CASE fold without an interpreter parse; incomplete blocks stay open', () => {
  const source = 'WHILE #a DO\n#x:=1;\nEND_WHILE;\nREPEAT\n#x:=2;\nUNTIL #a\nEND_REPEAT;\nCASE #a OF\n1: #x:=3;\nEND_CASE;\nIF #unfinished THEN';
  assert.deepEqual(foldRanges(source).map(r => [r.kind, r.end]), [['WHILE', 3], ['REPEAT', 7], ['CASE', 10]]);
  assert.deepEqual(foldRanges('FOR #i:=1 TO 3 DO\nIF #x THEN\nEND_FOR;'), []);
  assert.deepEqual(foldRanges('IF #x THEN #y:=1; END_IF;'), []);
});
test('visible/source offsets round-trip every visible character, including Unicode and trailing newline', () => {
  const source = 'IF #a THEN\n#s := \'ą😀\';\nEND_IF;\n#x := 2;\n', d = new FoldDocument(source);
  d.toggle(1);
  for (let offset = 0; offset <= d.view.length; offset++) assert.equal(d.toView(d.toSource(offset)), offset);
  assert.equal(d.rowForLine(2), null); assert.equal(d.rowForLine(4), 1);
  assert.equal(d.toSource(d.view.indexOf('#x')), source.indexOf('#x'));
});
test('typing outside a collapsed block retains hidden code and adjusts nested block positions', () => {
  const d = new FoldDocument('#x := 1;\n' + nested); d.toggle(3); // IF
  const next = '// note\n' + d.view.replace('#x := 1;', '#x := 100;'); d.editView(next);
  assert.equal(d.source, '// note\n#x := 100;\n' + nested);
  assert.ok(d.rows.some(r => r.line === 4 && r.range?.kind === 'IF'));
  assert.ok(!d.visibleLines.includes(5));
});
test('explicit selection across a collapsed block replaces its entire source; reveal expands ancestors only', () => {
  const d = new FoldDocument(nested); d.foldAll(); assert.deepEqual(d.visibleLines, [1, 10]);
  d.revealLine(4); assert.equal(d.rowForLine(4), 3); assert.equal(d.source, nested);
  d.foldAll(); d.editView('replacement'); assert.equal(d.source, 'replacement');
});
test('folding and view edits do not change compilation results or stored/exported full source', () => {
  const source = 'VAR x:INT; i:INT; END_VAR\nBEGIN\nFOR #i:=1 TO 3 DO\n#x:=#x+#i;\nEND_FOR;\n#x:=#x+10;';
  const d = new FoldDocument(source); d.foldAll();
  assert.equal(JSON.parse(JSON.stringify({code: d.source})).code, source);
  d.editView(d.view.replace('+10', '+20'));
  const m = compile(d.source); m.scan(); assert.equal(m.locals.x, 26);
});
test('replacement at a folded EOF includes hidden body only when the header is selected as a whole', () => {
  const source = 'IF #a THEN\n#x:=1;\nEND_IF;', d = new FoldDocument(source); d.foldAll();
  d.editView('IF #a THE'); assert.equal(d.source, source.replace('THEN', 'THE'));
  const all = new FoldDocument(source); all.foldAll(); all.editView('replacement'); assert.equal(all.source, 'replacement');
});
