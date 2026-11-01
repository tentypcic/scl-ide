import {diffLines, projectFilesForDiff} from './project-history.js';

export function setupHistoryPanel({getProject, getEntries, saveCurrent, checkpoint, restore, exportProject, exportRaw}) {
  const $ = s => document.querySelector(s), dialog = $('#historyDialog');
  let selected = null;
  const message = text => { $('#historyError').textContent = text; };
  const action = fn => { try { fn(); message(''); } catch (error) { message(error.message); } };
  const date = timestamp => new Date(timestamp).toLocaleString('pl-PL');
  const entry = () => getEntries().find(e => e.id === selected);

  function compare() {
    const version = entry(), current = getProject(), select = $('#historyFile');
    const container = $('#historyDiff');
    container.replaceChildren();
    if (!version) { $('#historySummary').textContent = 'Wybierz wersję z listy.'; return; }
    const oldFiles = projectFilesForDiff(version.project), newFiles = projectFilesForDiff(current);
    const globals = select.value === 'globals';
    const id = select.value.slice(5);
    const oldText = globals ? version.project.globals || '{}' : oldFiles[id] || '';
    const newText = globals ? current.globals || '{}' : newFiles[id] || '';
    const diff = diffLines(oldText, newText);
    const existence = globals ? '' : !Object.hasOwn(oldFiles, id) ? ' · Dodano program' : !Object.hasOwn(newFiles, id) ? ' · Usunięto program' : '';
    $('#historySummary').textContent = `${date(version.createdAt)} → teraz · +${diff.added} / −${diff.removed} linii${existence}${diff.simplified ? ' · Uproszczone porównanie dużego pliku' : ''}`;
    const fragment = document.createDocumentFragment();
    for (const row of diff.rows.slice(0, 2500)) {
      const line = document.createElement('div'); line.className = 'diff-line ' + row.type;
      for (const text of [row.oldLine ?? '', row.newLine ?? '', row.type === 'added' ? '+' : row.type === 'removed' ? '−' : '']) {
        const cell = document.createElement('span'); cell.className = 'diff-number'; cell.textContent = text; line.append(cell);
      }
      const source = document.createElement('code'); source.textContent = row.text || ' '; line.append(source); fragment.append(line);
    }
    container.append(fragment);
    if (diff.rows.length > 2500) {
      const note = document.createElement('p'); note.textContent = 'Podgląd pierwszych 2500 linii. Pobierz projekt, aby zachować pełne źródła.'; container.append(note);
    }
  }

  function selectVersion(id) {
    selected = id;
    $('#historyConfirm').hidden = true;
    const version = entry(), current = getProject(), select = $('#historyFile'), previous = select.value;
    select.replaceChildren();
    if (version) {
      const oldFiles = projectFilesForDiff(version.project), newFiles = projectFilesForDiff(current);
      for (const id of new Set([...Object.keys(newFiles), ...Object.keys(oldFiles)])) {
        const name = current.projectFiles?.[id] || version.project.projectFiles?.[id] || 'Program.scl';
        select.add(new Option(name, 'file:' + id));
      }
      select.add(new Option('Dane DB (JSON)', 'globals'));
      if ([...select.options].some(o => o.value === previous)) select.value = previous;
      else if ([...select.options].some(o => o.value === 'file:' + current.currentExample)) select.value = 'file:' + current.currentExample;
    }
    $('#historyRestore').disabled = !version;
    for (const button of $('#historyList').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.version === selected));
    compare();
  }

  function render() {
    const entries = getEntries().reverse(), list = $('#historyList'); list.replaceChildren();
    $('#historyCount').textContent = entries.length + ' wersji · 30 ostatnich automatycznych + nazwane';
    for (const version of entries) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.version = version.id;
      const label = document.createElement('strong'); label.textContent = version.label;
      const time = document.createElement('small'); time.textContent = date(version.createdAt) + (version.kind === 'manual' ? ' · Nazwana' : ' · Automatyczna');
      button.append(label, time); button.onclick = () => selectVersion(version.id); list.append(button);
    }
    if (!entries.length) { const note = document.createElement('p'); note.textContent = 'Historia zacznie się od pierwszego zapisu wersji lub zmiany kodu.'; list.append(note); }
    selectVersion(entries.some(e => e.id === selected) ? selected : entries[0]?.id);
  }

  $('#historyBtn').onclick = () => {
    try { saveCurrent(); message(''); } catch (error) { message(error.message); }
    render(); dialog.showModal();
  };
  $('#historyClose').onclick = () => dialog.close();
  $('#historyFile').onchange = compare;
  $('#historySave').onclick = () => action(() => {
    const label = $('#historyLabel').value.trim() || 'Moja wersja';
    checkpoint(label); $('#historyLabel').value = ''; selected = getEntries().at(-1)?.id; render();
  });
  $('#historyRestore').onclick = () => {
    const version = entry(); if (!version) return;
    $('#historyConfirmText').textContent = `Przywrócisz cały projekt „${version.label}”: ${Object.keys(projectFilesForDiff(version.project)).length} programów, kosz i ustawienia. Obecna praca zostanie zachowana w historii.`;
    $('#historyConfirm').hidden = false;
  };
  $('#historyCancelRestore').onclick = () => { $('#historyConfirm').hidden = true; };
  $('#historyConfirmRestore').onclick = () => action(() => { const version = entry(); if (!version) return; restore(version); render(); });
  $('#historyExport').onclick = () => action(exportProject);
  $('#historyExportRaw').onclick = () => action(exportRaw);
}
