import {FoldDocument, lineStarts} from './folding-core.js';

// Keep the public editor interface in full-source coordinates. Only the native
// textarea value is projected; compilation, assistance and exports see all text.
export function setupCodeFolding(code, {onViewChange, getDocumentId}) {
  const proto = HTMLTextAreaElement.prototype;
  const value = Object.getOwnPropertyDescriptor(proto, 'value');
  const start = Object.getOwnPropertyDescriptor(proto, 'selectionStart');
  const end = Object.getOwnPropertyDescriptor(proto, 'selectionEnd');
  const nativeSelect = proto.setSelectionRange;
  let model = new FoldDocument(value.get.call(code)), documentId = getDocumentId();
  let before = null, nativeEdit = false, past = [], future = [], typing = null;
  const layer = document.createElement('div'); layer.className = 'fold-summaries'; code.parentElement.append(layer);
  const ctx = document.createElement('canvas').getContext('2d');
  const nativeStart = () => start.get.call(code), nativeEnd = () => end.get.call(code);
  const selection = () => {
    const a = nativeStart(), b = nativeEnd(), last = model.rows.at(-1);
    const terminalFoldSelected = last?.range && a <= last.viewStart && b > a && b === model.view.length;
    return {start: model.toSource(a), end: terminalFoldSelected ? model.source.length : model.toSource(b)};
  };
  const frame = () => ({source: model.source, ...selection()});
  const remember = (state, textInput = false, cursor = null) => {
    const now = Date.now(), merge = textInput && typing && now - typing.at < 700 && typing.end === state.start && state.start === state.end;
    if (!merge) past.push(state);
    future = []; typing = textInput ? {at: now, end: cursor} : null;
    while (past.length > 100 || past.reduce((n, p) => n + p.source.length, 0) > 4000000) past.shift();
  };
  const lineOf = offset => lineStarts(model.source).filter(n => n <= offset).length;

  function summaries() {
    const style = getComputedStyle(code), height = parseFloat(style.lineHeight) || 24;
    ctx.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    layer.replaceChildren();
    model.rows.forEach((row, index) => {
      const top = index * height - code.scrollTop;
      if (!row.range || top < -height || top > code.clientHeight) return;
      const left = ctx.measureText(row.text.replaceAll('\t', '    ')).width + (parseFloat(style.letterSpacing) || 0) * row.text.length + 18 - code.scrollLeft;
      if (left > code.clientWidth - 65) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'fold-summary';
      button.style.top = top + 'px'; button.style.left = Math.max(8, left) + 'px'; button.style.height = height + 'px';
      button.textContent = '… ' + (row.range.end - row.range.start) + ' linii';
      button.setAttribute('aria-label', 'Rozwiń ' + row.range.kind + ' w linii ' + row.line);
      button.onclick = () => toggle(row.line); layer.append(button);
    });
  }
  function paint(selectionToKeep = selection()) {
    const top = code.scrollTop, left = code.scrollLeft;
    value.set.call(code, model.view);
    nativeSelect.call(code, model.toView(selectionToKeep.start), model.toView(selectionToKeep.end));
    code.scrollTop = top; code.scrollLeft = left; summaries();
  }
  function changedView(keep) {paint(keep); onViewChange();}
  function selectSource(a, b = a, direction) {
    a = Math.max(0, Math.min(model.source.length, a)); b = Math.max(a, Math.min(model.source.length, b));
    const revealed = model.revealLine(lineOf(a)) | model.revealLine(lineOf(b));
    if (revealed) changedView({start: a, end: b});
    nativeSelect.call(code, model.toView(a), model.toView(b), direction); summaries();
  }
  function toggle(line) {
    const keep = selection(), range = model.rangeAt(line); if (!range) return;
    model.toggle(line);
    // A cursor inside the collapsed region belongs on its visible header.
    if (model.collapsed.has(range.key)) {
      const headerEnd = model.rows.find(r => r.line === line).sourceEnd;
      if (keep.start > headerEnd && keep.start < model.starts[range.end - 1] + model.source.split('\n')[range.end - 1].length + 1) keep.start = keep.end = headerEnd;
    }
    changedView(keep);
  }
  function all(collapse) {
    const keep = selection(); if (collapse) model.foldAll(); else model.unfoldAll();
    if (collapse) {keep.start = model.toSource(model.toView(keep.start)); keep.end = keep.start;}
    changedView(keep);
  }
  function undo(redo = false) {
    typing = null;
    const from = redo ? future : past, to = redo ? past : future, state = from.pop(); if (!state) return;
    to.push(frame()); model.setSource(state.source); paint(state); selectSource(state.start, state.end);
    code.dispatchEvent(new Event('input', {bubbles: true}));
  }
  function replace(text, a, b, mode = 'preserve') {
    const previous = frame(); model.replace(a, b, text); if (model.source !== previous.source) remember(previous);
    const delta = text.length - (b - a); let keep;
    if (mode === 'select') keep = {start: a, end: a + text.length};
    else if (mode === 'start') keep = {start: a, end: a};
    else if (mode === 'end') keep = {start: a + text.length, end: a + text.length};
    else keep = {start: previous.start > b ? previous.start + delta : previous.start > a ? a : previous.start, end: previous.end > b ? previous.end + delta : previous.end > a ? a + text.length : previous.end};
    paint(keep); selectSource(keep.start, keep.end);
  }
  Object.defineProperties(code, {
    value: {configurable: true, get: () => model.source, set: source => {
      source = String(source).replace(/\r\n?/g, '\n');
      if (getDocumentId() !== documentId) {documentId = getDocumentId(); model = new FoldDocument(source); past = []; future = []; before = null; typing = null; paint({start: 0, end: 0}); return;}
      const previous = frame(); model.setSource(source); if (source !== previous.source) remember(previous); paint({start: Math.min(previous.start, source.length), end: Math.min(previous.end, source.length)});
    }},
    selectionStart: {configurable: true, get: () => selection().start, set: n => selectSource(n, Math.max(n, selection().end))},
    selectionEnd: {configurable: true, get: () => selection().end, set: n => selectSource(Math.min(n, selection().start), n)},
    setSelectionRange: {configurable: true, value: selectSource},
    setRangeText: {configurable: true, value: (text, a = selection().start, b = selection().end, mode) => replace(text, a, b, mode)},
  });

  function unfoldAtDelete(inputType) {
    if (nativeStart() !== nativeEnd()) return false;
    const offset = nativeStart(), row = model.rows.find(r => r.viewStart <= offset && offset <= r.viewStart + r.text.length);
    if (!row) return false;
    const i = model.rows.indexOf(row);
    const folded = inputType === 'deleteContentForward' && offset === row.viewStart + row.text.length ? row.range
      : inputType === 'deleteContentBackward' && offset === row.viewStart ? model.rows[i - 1]?.range : null;
    if (!folded) return false;
    const keep = selection(); model.collapsed.delete(folded.key); model.rebuild(); changedView(keep); return true;
  }
  code.addEventListener('beforeinput', e => {
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {e.preventDefault(); nativeEdit = false; undo(e.inputType === 'historyRedo'); return;}
    if (unfoldAtDelete(e.inputType)) {e.preventDefault(); nativeEdit = false; return;}
    before = {...frame(), textInput: e.inputType === 'insertText'}; nativeEdit = true;
  }, true);
  code.addEventListener('input', () => {
    const projected = value.get.call(code);
    if (projected === model.view) {before = null; nativeEdit = false; return;}
    const previous = before || frame(); before = null; let keep;
    if (previous.source === model.source && projected !== model.view && previous !== null) {
      // Native beforeinput supplies the old model. Script-driven fill has no
      // beforeinput and replaces the entire buffer, as an ordinary textarea does.
      if (nativeEdit) keep = model.editView(projected, previous);
      else {model.setSource(projected); keep = {start: model.source.length, end: model.source.length};}
    }
    if (model.source !== previous.source) remember(previous, nativeEdit && previous.textInput && previous.start === previous.end, keep?.start);
    keep ||= selection(); paint(keep); selectSource(keep.start, keep.end); nativeEdit = false;
  }, true);
  code.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {e.preventDefault(); e.stopImmediatePropagation(); undo(e.key.toLowerCase() === 'y' || e.shiftKey); return;}
    if (mod && e.shiftKey && ['BracketLeft', 'BracketRight'].includes(e.code)) {
      e.preventDefault(); e.stopImmediatePropagation(); const line = lineOf(selection().start);
      const r = [...model.ranges].reverse().find(r => r.start <= line && r.end >= line);
      if (r && model.collapsed.has(r.key) !== (e.code === 'BracketLeft')) toggle(r.start);
    }
  }, true);
  for (const type of ['copy', 'cut']) code.addEventListener(type, e => {
    if (!e.clipboardData) return;
    const s = selection(); if (s.start === s.end) return;
    e.clipboardData.setData('text/plain', model.source.slice(s.start, s.end)); e.preventDefault();
    if (type === 'cut') {replace('', s.start, s.end, 'start'); code.dispatchEvent(new Event('input', {bubbles: true}));}
  });
  layer.onmousedown = e => e.preventDefault();
  code.addEventListener('scroll', summaries); window.addEventListener('resize', summaries); window.addEventListener('scl-layout', summaries);
  const api = {
    get rows() {return model.rows;}, get ranges() {return model.ranges;}, get collapsed() {return model.collapsed;},
    rangeAt: line => model.rangeAt(line), rowForLine: line => model.rowForLine(line),
    revealLine: line => {const keep = selection(); const changed = model.revealLine(line); if (changed) changedView(keep); return changed;},
    view: () => model.view, prefix: () => model.view.slice(0, nativeStart()), toggle,
    foldAll: () => all(true), unfoldAll: () => all(false), render: summaries,
  };
  code.folding = api; return api;
}
