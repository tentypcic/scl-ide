const translations = new Map(Object.entries({
  'Język': 'Language', 'Motyw': 'Theme', 'Ciemny': 'Dark', 'Jasny': 'Light',
  'Przewodnik': 'Guide', 'Pliki': 'Files', 'Zmienne': 'Variables',
  'Panel': 'Panel', 'Skupienie': 'Focus', 'Projekt': 'Project',
  'Otwórz plik': 'Open file', 'PLIKI PROJEKTU': 'PROJECT FILES',
  '＋ Nowy program': '＋ New program', '＋ Nowy typ UDT': '＋ New UDT',
  '⌘ Kod testowy SCL': '⌘ Sample SCL code',
  'Dane zapisujesz w tej przeglądarce. Pobierz projekt, aby zachować niezależną kopię.': 'Your data stays in this browser. Download the project to keep a separate backup.',
  'Ustawienia': 'Settings', 'Autoformat przy zapisie / wklejaniu': 'Format on save / paste',
  'CZCIONKA': 'FONT', 'CYKL': 'SCAN', 'TEMPO': 'SPEED',
  'Uruchom': 'Run', 'Pauza': 'Pause', 'Instrukcja': 'Step', 'Cykl': 'Scan',
  '◷ Historia': '◷ History', '◉ Wartości': '◉ Values', 'Narzędzia': 'Tools',
  'ƒ Funkcje': 'ƒ Functions', '⊟ Zwiń': '⊟ Fold', '⊞ Rozwiń': '⊞ Unfold',
  '≡ Formatuj': '≡ Format', '✦ Szablony': '✦ Snippets', 'Sprawdź': 'Check',
  '⇄ Wejścia / wyjścia': '⇄ Inputs / outputs', '∿ Przebiegi': '∿ Traces',
  '›_ Konsola': '›_ Console', 'Sygnały programu': 'Program signals',
  'Panel na podstawie deklaracji VAR_INPUT / VAR_OUTPUT': 'Based on VAR_INPUT / VAR_OUTPUT declarations',
  '＋ Dodaj zmienną': '＋ Add variable', 'WEJŚCIA': 'INPUTS', 'WYJŚCIA': 'OUTPUTS',
  'ustaw wartość lub podaj impuls': 'set a value or send a pulse',
  'wyniki Twojego programu': 'program results',
  '① Ustaw wejścia': '① Set inputs', '② Wykonaj cykl lub uruchom': '② Scan or run',
  '③ Obserwuj wynik': '③ Watch the result', 'Przebiegi sygnałów': 'Signal traces',
  'DIAGNOSTYKA I ZDARZENIA': 'DIAGNOSTICS AND EVENTS', 'Wyczyść': 'Clear',
  'SYMULACJA': 'SIMULATION', 'Podgląd zmiennych': 'Variable monitor',
  'CYKL PLC': 'PLC SCAN', 'CZAS SYMULACJI': 'SIMULATION TIME',
  'Obserwowane': 'Watch list', 'Dane DB': 'DB data', 'NAZWA / TYP': 'NAME / TYPE',
  'WARTOŚĆ': 'VALUE', 'Globalne dane testowe': 'Global test data',
  'Anuluj': 'Cancel', 'Dodaj i sprawdź': 'Add and check',
  'Nazwa zmiennej': 'Variable name', 'Sekcja': 'Section', 'Typ': 'Type',
  'Gotowy do testów': 'Ready to test', 'Zatrzymany': 'Stopped',
  'Zapisano w przeglądarce': 'Saved in this browser',
}));
const english = new Map([...translations].map(([pl, en]) => [en, pl]));
const language = document.querySelector('#uiLanguage');
const theme = document.querySelector('#uiTheme');
const controls = '.topbar, .sidebar, .toolbar, .editor-actions, .editor-status, .panel-tabs, .io-top, .io-column-title, .io-foot, .inspector-header, .inspector-tabs, dialog';

function readPreference(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}

function savePreference(key, value) {
  try { localStorage.setItem(key, value); }
  catch { /* Settings still apply to this tab. */ }
}

function updateLanguage() {
  document.documentElement.lang = language.value;
  language.textContent = language.value === 'en' ? 'PL' : 'EN';
  language.title = language.value === 'en' ? 'Przełącz na polski' : 'Switch to English';
  language.setAttribute('aria-label', language.title);
  updateThemeLabel();
  const dictionary = language.value === 'en' ? translations : english;
  for (const section of document.querySelectorAll(controls)) {
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('#userProjects, pre, code, textarea, option[value="pl"], option[value="en"]')) continue;
      const label = node.data.trim();
      const translated = dictionary.get(label);
      if (translated && translated !== label) node.data = node.data.replace(label, translated);
    }
  }
}

language.value = readPreference('scl-ide-language', 'pl') === 'en' ? 'en' : 'pl';
theme.value = readPreference('scl-ide-theme', 'dark') === 'light' ? 'light' : 'dark';
document.documentElement.dataset.theme = theme.value;
updateLanguage();
language.addEventListener('click', () => {
  language.value = language.value === 'en' ? 'pl' : 'en';
  savePreference('scl-ide-language', language.value);
  updateLanguage();
});
theme.addEventListener('click', () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
  savePreference('scl-ide-theme', theme.value);
  document.documentElement.dataset.theme = theme.value;
  updateThemeLabel();
  window.dispatchEvent(new Event('scl-layout'));
});
function updateThemeLabel() {
  theme.title = language.value === 'en' ? 'Toggle light theme' : 'Przełącz jasny motyw';
  theme.setAttribute('aria-label', theme.title);
  theme.setAttribute('aria-pressed', String(theme.value === 'light'));
}

const observer = new MutationObserver(() => {
  if (language.value === 'en') updateLanguage();
});
for (const selector of ['#runLabel', '#compileStatus', '#saveStatus', '#executionStatus']) {
  observer.observe(document.querySelector(selector), { subtree: true, childList: true, characterData: true });
}
