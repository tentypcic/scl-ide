import test from 'node:test';
import assert from 'node:assert/strict';
import {compile, Parser, SclError, lex, globalsFromJSON} from '../dist/engine.js';
import {collectSymbols} from '../dist/assist-core.js';

const wrap = (decl, body) => `FUNCTION_BLOCK "Audit"\n${decl}\nBEGIN\n${body}\nEND_FUNCTION_BLOCK`;
const errorOf = source => {try {new Parser(source).parse();} catch (error) {assert.ok(error instanceof SclError, error.stack); return error;} assert.fail('Expected a syntax error');};

test('nested CASE keeps inner ELSE and following statements in the correct outer arm', () => {
  const source = wrap('VAR outerValue:INT; innerValue:INT; result:INT; END_VAR', `
CASE #outerValue OF
  1:
    CASE #innerValue OF
      2,3: #result := 20;
      4...6: #result := 30;
      ELSE #result := 40;
    END_CASE;
    #result := #result + 1;
  2: #result := 100;
  ELSE #result := 900;
END_CASE;`);
  for (const [outer, inner, expected] of [[1,2,21],[1,5,31],[1,99,41],[2,2,100],[99,2,900]]) {
    const m = compile(source); m.input('outerValue', outer); m.input('innerValue', inner); m.scan();
    assert.equal(m.locals.result, expected);
  }
});

test('CASE accepts long lists after a previous arm without a 30-token lookahead cutoff', () => {
  const labels = Array.from({length: 60}, (_, i) => i + 1).join(', ');
  const m = compile(wrap('VAR x:INT:=59; result:INT; END_VAR', `CASE #x OF 0: #result:=1; ${labels}: #result:=2; END_CASE;`));
  m.scan(); assert.equal(m.locals.result, 2);
});

test('WHILE and REPEAT may start a CASE arm and contain nested CASE/IF/FOR control flow', () => {
  const m = compile(wrap('VAR i:INT; j:INT; result:INT; END_VAR', `
CASE 1 OF
  1:
    WHILE #i < 3 DO
      #i := #i + 1;
      CASE #i OF
        1: CONTINUE;
        2: FOR #j := 1 TO 2 DO IF #j = 2 THEN EXIT; END_IF; #result := #result + 4; END_FOR;
        ELSE #result := #result + 8;
      END_CASE;
    END_WHILE;
    REPEAT #result := #result + 1; UNTIL #result >= 14 END_REPEAT;
END_CASE;`));
  m.scan(); assert.equal(m.locals.result, 14); assert.equal(m.locals.i, 3);
});

test('quoted keyword globals remain references, never control-flow delimiters', () => {
  const m = compile(wrap('', `"IF" := 3; CASE "CASE" OF 1: "END_CASE" := 7; ELSE "END_CASE" := 9; END_CASE;`), {globals: globalsFromJSON('{"IF":0,"CASE":1,"END_CASE":0}')});
  m.scan(); assert.equal(m.read('"IF"').v, 3); assert.equal(m.read('"END_CASE"').v, 7);
});

test('quoted DB names and multidimensional array/STRUCT paths survive nested control flow', () => {
  const m = compile(wrap('VAR a:ARRAY[-1..0,1..2] OF STRUCT v:INT; END_STRUCT; END_VAR', `CASE "DB test".Tryb OF 2: CASE 1 OF 1: #a[-1,2].v := "DB test".Dane[1].Wartosc; END_CASE; END_CASE;`), {globals: globalsFromJSON('{"DB test":{"Tryb":2,"Dane":[{"Wartosc":8},{"Wartosc":42}]}}')});
  m.scan(); assert.equal(m.read('#a[-1,2].v').v, 42);
});

for (const [kind, end] of [['FUNCTION_BLOCK','END_FUNCTION_BLOCK'], ['FUNCTION','END_FUNCTION'], ['ORGANIZATION_BLOCK','END_ORGANIZATION_BLOCK']]) {
  test(`${kind} requires BEGIN and its own matching terminator`, () => {
    const header = `${kind} "Audit"${kind === 'FUNCTION' ? ' : VOID' : ''}`;
    assert.match(errorOf(header + '\nBEGIN').message, new RegExp(end));
    const wrong = end === 'END_FUNCTION' ? 'END_FUNCTION_BLOCK' : 'END_FUNCTION';
    assert.match(errorOf(header + '\nBEGIN\n' + wrong).message, new RegExp(end));
    assert.match(errorOf(header + '\n' + end).message, /BEGIN/);
    new Parser(header + '\nBEGIN\n' + end).parse();
  });
}

test('headerless body snippets remain supported', () => {
  const m = compile('VAR x:INT; END_VAR BEGIN #x:=3;'); m.scan(); assert.equal(m.locals.x, 3);
});

test('declaration suggestions survive strict FC/FB/OB ending checks', () => {
  for (const header of ['FUNCTION "FC" : INT', 'FUNCTION_BLOCK "FB"', 'ORGANIZATION_BLOCK "OB"']) {
    const data = collectSymbols(header + '\nVAR_INPUT\nValue:INT;\nEND_VAR\nBEGIN\n#Val');
    assert.equal(data.locals.Value.name, 'INT');
    if (header.startsWith('FUNCTION "')) assert.equal(data.locals.FC.name, 'INT');
  }
});

test('typed exponents, signed values and digit separators parse without truncation', () => {
  const m = compile(wrap('VAR x:REAL; y:DINT; z:WORD; a:ARRAY[-1_000..-999] OF INT; END_VAR', '#x := REAL#-1.5e+2; #y := DINT#1_000; #z := WORD#16#F_F; #a[-1000] := 3;'));
  m.scan(); assert.equal(m.locals.x, -150); assert.equal(m.locals.y, 1000); assert.equal(m.locals.z, 255); assert.equal(m.locals.a[-1000], 3);
});

test('malformed based literals never silently truncate to another number', () => {
  for (const value of ['2#102', '8#19', '16#FG', 'WORD#2#102', '16#_', '2#', 'INT#1.5', 'BOOL#2', '1e999']) {
    assert.match(errorOf(wrap('VAR x:INT; END_VAR', '#x := ' + value + ';')).message, /literał|liczb|stał/i, value);
  }
});

test('tokens retain exact UTF-16 ranges including raw quoted spellings and CRLF', () => {
  const source = '// 😀\r\n"DB ""test""".Pole := \'😀\';';
  const tokens = lex(source), db = tokens.find(t => t.kind === 'global'), str = tokens.find(t => t.kind === 'string');
  assert.equal(db.text, 'DB "test"'); assert.equal(source.slice(db.start, db.end), '"DB ""test"""');
  assert.equal(db.line, 2); assert.equal(db.col, 1);
  assert.equal(source.slice(str.start, str.end), "'😀'");
  const semi = tokens.find(t => t.text === ';');
  assert.equal(semi.col, source.slice(source.indexOf('\n') + 1, semi.start).length + 1);
  assert.equal(tokens.at(-1).start, source.length); assert.equal(tokens.at(-1).end, source.length);
});

test('syntax errors point to the offending token and missing tokens use the EOF position', () => {
  const source = '// 😀\r\nIF TRUE\r\n#x := 1;\r\nEND_IF;';
  const error = errorOf(source);
  assert.match(error.message, /THEN/); assert.equal(error.line, 3); assert.equal(error.col, 1);
  assert.deepEqual(error.range, {start: source.indexOf('#x'), end: source.indexOf('#x') + 2});
  const incomplete = 'BEGIN\nIF TRUE THEN'; const eof = errorOf(incomplete);
  assert.match(eof.message, /END_IF/); assert.deepEqual(eof.range, {start: incomplete.length, end: incomplete.length});
});

test('unclosed lexemes and invalid characters have bounded source ranges', () => {
  for (const [source, start, length] of [["BEGIN\n'abc",6,1], ['BEGIN\n(* abc',6,2], ['BEGIN\n{ abc',6,1], ['BEGIN\n😀',6,2]]) {
    const error = errorOf(source); assert.deepEqual(error.range, {start, end: start + length});
  }
});

test('CASE, expression and type nesting limits return SclError instead of stack overflow', () => {
  for (const source of [
    'BEGIN ' + 'CASE 1 OF 1: '.repeat(90) + ';' + 'END_CASE;'.repeat(90),
    'VAR x:INT; END_VAR BEGIN #x := ' + '('.repeat(200) + '1' + ')'.repeat(200) + ';',
    'VAR x:' + 'ARRAY[1..1] OF '.repeat(100) + 'INT; END_VAR BEGIN',
  ]) assert.match(errorOf(source).message, /zagnieżdżenie/);
});

test('parser errors are deterministic and never execute source', () => {
  const source = wrap('VAR result:INT; END_VAR', '#result:=1; IF TRUE #result:=2; END_IF;');
  const first = errorOf(source), second = errorOf(source);
  assert.equal(first.message, second.message); assert.deepEqual(first.range, second.range);
});

test('a long left-associated expression is bounded before runtime validation recurses', () => {
  assert.throws(() => compile(wrap('VAR x:DINT; END_VAR', '#x := ' + Array(2000).fill('1').join('+') + ';')), error => error instanceof SclError && /zagnieżdżenie/.test(error.message));
});

test('operator precedence and keyword-looking strings remain unchanged', () => {
  const m = compile(wrap('VAR x:INT; text:STRING; END_VAR', "#x := 2 + 3 * 4; #text := 'END_CASE';"));
  m.scan(); assert.equal(m.locals.x, 14); assert.equal(m.locals.text, 'END_CASE');
});

test('syntax failure prevents earlier global assignments from taking effect', () => {
  const globals = globalsFromJSON('{"DB":{"Counter":4}}');
  assert.throws(() => compile('BEGIN "DB".Counter := 99; IF TRUE', {globals}), SclError);
  assert.equal(globals.DB.value.Counter, 4);
});

test('unsafe array bounds are rejected before allocation can stop progressing', () => {
  const source = 'VAR a:ARRAY[9007199254740992..9007199254740992] OF BOOL; END_VAR BEGIN';
  assert.match(errorOf(source).message, /bezpiecznym zakresie/);
});

test('forbidden declaration names preserve their diagnostic location', () => {
  const source = 'VAR\nconstructor:INT;\nEND_VAR BEGIN';
  const error = errorOf(source); assert.equal(error.line, 2);
  assert.deepEqual(error.range, {start: 4, end: 15});
});

test('every typing prefix of a nested program yields bounded diagnostics rather than native exceptions', () => {
  const source = wrap('VAR a:ARRAY[-1..2] OF STRUCT v:REAL; END_STRUCT; END_VAR', 'CASE 1 OF 1: CASE 2 OF 2: #a[-1].v := REAL#1.5e2; END_CASE; ELSE #a[0].v := 0; END_CASE;');
  for (let end = 0; end <= source.length; end++) {
    try {new Parser(source.slice(0, end)).parse();}
    catch (error) {
      assert.ok(error instanceof SclError, `Prefix ${end}: ${error.stack}`);
      assert.ok(error.range && error.range.start >= 0 && error.range.end >= error.range.start && error.range.end <= end, `Prefix ${end}: ${JSON.stringify(error.range)}`);
    }
  }
});
