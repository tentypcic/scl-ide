import {declarationSections} from './language-catalog.js';
const kinds = new Set(['IF', 'FOR', 'WHILE', 'REPEAT', 'CASE', 'REGION', 'STRUCT', ...declarationSections]);
export function lineStarts(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1);
  return starts;
}
function floorIndex(values, offset, key = x => x) {
  let lo = 0, hi = values.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (key(values[mid]) <= offset) lo = mid; else hi = mid - 1; }
  return lo;
}

// Mask comments, strings and quoted symbols without moving UTF-16 offsets.
// This scanner deliberately does not execute or require a complete SCL program.
export function maskSCL(source) {
  const chars = source.split(''); let quote = null, comments = [];
  const blank = i => { if (source[i] !== '\n' && source[i] !== '\r') chars[i] = ' '; };
  for (let i = 0; i < source.length; i++) {
    const pair = source.slice(i, i + 2), c = source[i];
    if (quote) {
      blank(i);
      if (c === '$' && i + 1 < source.length) {blank(++i); continue;}
      if (c === quote) {if (source[i + 1] === quote) blank(++i); else quote = null;}
      continue;
    }
    if (comments.length) {
      blank(i);
      if (pair === '(*' || pair === '/*') {comments.push(pair === '(*' ? '*)' : '*/'); blank(++i);}
      else if (pair === comments.at(-1)) {comments.pop(); blank(++i);}
      continue;
    }
    if (pair === '//') {while (i < source.length && source[i] !== '\n') blank(i++); i--; continue;}
    if (pair === '(*' || pair === '/*') {comments.push(pair === '(*' ? '*)' : '*/'); blank(i); blank(++i); continue;}
    if (c === "'" || c === '"') {quote = c; blank(i);}
  }
  return chars.join('');
}

export function foldRanges(source) {
  const starts = lineStarts(source), masked = maskSCL(source), stack = [], ranges = [];
  const tokens = /\b(?:END_REGION|END_REPEAT|END_WHILE|END_CASE|END_FOR|END_IF|END_VAR|END_STRUCT|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR_TEMP|VAR_CONSTANT|VAR_STAT|VAR|STRUCT|REGION|REPEAT|WHILE|CASE|FOR|IF)\b/gi;
  let regionTitleEnd = -1;
  for (const token of masked.matchAll(tokens)) {
    if (token.index < regionTitleEnd || /[#.\w]/.test(masked[token.index - 1] || ' ')) continue;
    const name = token[0].toUpperCase(), line = floorIndex(starts, token.index) + 1;
    if (name === 'REGION') {const eol = source.indexOf('\n', token.index); regionTitleEnd = eol < 0 ? source.length : eol;}
    if (kinds.has(name)) {
      const inDeclaration = stack.some(r => declarationSections.includes(r.kind) || r.kind === 'STRUCT');
      if (inDeclaration && ['IF', 'FOR', 'WHILE', 'REPEAT', 'CASE'].includes(name)) continue;
      stack.push({kind: name, start: line, from: token.index}); continue;
    }
    const kind = name.slice(4), top = stack.at(-1);
    // Do not invent crossed ranges when the user is still typing END_*.
    if (!top || (kind === 'VAR' ? !declarationSections.includes(top.kind) : top.kind !== kind)) continue;
    stack.pop();
    if (line > top.start) ranges.push({...top, end: line, to: token.index + token[0].length, key: top.kind + ':' + top.from});
  }
  return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
}

export function textChange(before, after) {
  let start = 0, suffix = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (suffix < before.length - start && suffix < after.length - start && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  return {start, end: before.length - suffix, text: after.slice(start, after.length - suffix)};
}

export class FoldDocument {
  constructor(source = '') {this.source = source; this.collapsed = new Set(); this.rebuild();}
  rebuild() {
    this.ranges = foldRanges(this.source); this.starts = lineStarts(this.source);
    const valid = new Set(this.ranges.map(r => r.key));
    this.collapsed = new Set([...this.collapsed].filter(k => valid.has(k)));
    const lines = this.source.split('\n'), folded = this.ranges.filter(r => this.collapsed.has(r.key));
    this.rows = []; let viewStart = 0, index = 0;
    while (index < lines.length) {
      const range = folded.find(r => r.start === index + 1);
      this.rows.push({line: index + 1, text: lines[index], sourceStart: this.starts[index], sourceEnd: this.starts[index] + lines[index].length, viewStart, range});
      viewStart += lines[index].length + 1;
      index = range ? range.end : index + 1;
    }
    this.view = this.rows.map(r => r.text).join('\n');
    this.visibleLines = this.rows.map(r => r.line);
  }
  rangeAt(line) { return this.ranges.find(r => r.start === line); }
  toggle(line) {const r = this.rangeAt(line); if (!r) return false; if (this.collapsed.has(r.key)) this.collapsed.delete(r.key); else this.collapsed.add(r.key); this.rebuild(); return true;}
  foldAll() {this.collapsed = new Set(this.ranges.map(r => r.key)); this.rebuild();}
  unfoldAll() {this.collapsed.clear(); this.rebuild();}
  revealLine(line) {
    let changed = false;
    for (const r of this.ranges) if (r.start < line && line <= r.end) changed = this.collapsed.delete(r.key) || changed;
    if (changed) this.rebuild(); return changed;
  }
  rowForLine(line) {const row = floorIndex(this.rows, line, r => r.line); return this.rows[row]?.line === line ? row : null;}
  toSource(offset) {
    offset = Math.max(0, Math.min(this.view.length, offset));
    const r = this.rows[floorIndex(this.rows, offset, r => r.viewStart)];
    return r.sourceStart + Math.min(r.text.length, offset - r.viewStart);
  }
  toView(offset) {
    offset = Math.max(0, Math.min(this.source.length, offset));
    const r = this.rows[floorIndex(this.rows, offset, r => r.sourceStart)];
    return r.viewStart + Math.min(r.text.length, offset - r.sourceStart);
  }
  replace(start, end, text) {this.setSource(this.source.slice(0, start) + text + this.source.slice(end));}
  setSource(source) {
    if (source === this.source) return;
    const edit = textChange(this.source, source), delta = edit.text.length - (edit.end - edit.start), kept = new Set();
    for (const r of this.ranges) if (this.collapsed.has(r.key)) {
      if (edit.start > r.from) kept.add(r.key);
      else if (edit.end <= r.from) kept.add(r.kind + ':' + (r.from + delta));
    }
    this.collapsed = kept; this.source = source; this.rebuild();
  }
  editView(nextView, selection = null) {
    const edit = textChange(this.view, nextView), start = this.toSource(edit.start);
    // A folded block can be the final visible row. Select-all must include its
    // hidden closing line, while editing a character on its header must not.
    const includesEOF = edit.end === this.view.length && (selection?.end === this.source.length || (edit.start === 0 && edit.end > edit.start));
    const end = includesEOF ? this.source.length : this.toSource(edit.end);
    this.replace(start, end, edit.text);
    return {start: start + edit.text.length, end: start + edit.text.length};
  }
}
