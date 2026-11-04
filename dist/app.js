import {renderLiveControls,createValueEditor} from './live-controls.js';
import {languageKeywords,supportedTypes} from './language-catalog.js';
import {compile,Parser,globalsFromJSON,supportedFunctions} from './engine.js';
import {insertDeclaration,ioSignals} from './source-tools.js';
import {setupAssist} from './assist.js';
import {formatSCL} from './formatter.js';
import {setupInlineMonitor} from './inline-monitor.js';
import {ProjectHistory,HISTORY_KEY,validateProject,importedEntries,revisionId} from './project-history.js';
import {setupHistoryPanel} from './history-panel.js';
import {withTestProgram,decodeImport} from './project-actions.js';
import {setupCodeFolding} from './code-folding.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let editorFolding=null,runtimeMonitor=null,projectHistory=null,storageBlocked=false,storageError='';
const code=$('#code');let machine=null,running=false,dirty=false,errorLine=null,interval=null,renderTick=0,skipBreakpoint=null,lastSaved=0,currentExample='user_default',filename='MojProgram.scl',activeInspect='locals',activePanel='io';
let breakpoints=new Set(),expanded=new Set(),history=[],logs=[],watches=[],drafts={},projectFiles={},trash={},loaded=false,toastTimer,saveTimer;
const blankSource=`FUNCTION_BLOCK "MojProgram"
VAR_INPUT
    // Tutaj zadeklaruj własne wejścia.
END_VAR
VAR_OUTPUT
    // Tutaj zadeklaruj własne wyjścia.
END_VAR
VAR
    // Tutaj zadeklaruj pamięć i instancje timerów.
END_VAR
BEGIN
    // Napisz swój kod SCL.
    // Zmienne możesz też dodać przyciskiem „＋ Dodaj zmienną”.
END_FUNCTION_BLOCK`;
const examples={};
const legacyExamples={"starter": {"hash": "5e8165da", "file": "MojProgram.scl"}, "magnets": {"hash": "43da3114", "file": "FB_AnimacjaMagnesow.scl"}, "timer": {"hash": "6588f62c", "file": "FB_Timer.scl"}, "counter": {"hash": "a51b5233", "file": "FB_Sekwencja.scl"}, "array": {"hash": "e4a9302d", "file": "FB_Tablice.scl"}};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
let debugPromptLog = null;
function log(message,type='info',line=null){const entry={message,type,line,time:machine?.now||0};logs.push(entry);if(logs.length>150)logs.shift();renderLogs();return entry;}
function renderLogs(){const el=$('#logs'),form=$('#debugInputForm'),focused=form.contains(document.activeElement)?document.activeElement:null;el.innerHTML=logs.map(l=>`<div class="log-row ${l.type}"><span class="log-time">${(l.time/1000).toFixed(2)} s</span><span class="log-icon">${l.type==='error'?'!':l.type==='warn'?'△':'✓'}</span><div class="log-text">${esc(l.message)}${l.line?` <button class="error-jump" data-line="${l.line}">Linia ${l.line}</button>`:''}</div></div>`).join('');
 const promptRow=el.children[logs.indexOf(debugPromptLog)];
 if(promptRow)promptRow.querySelector('.log-text').append(form);
 else el.after(form);
 focused?.focus({preventScroll:true});
 $('#logCount').textContent=logs.length;if(activePanel==='console')el.parentElement.scrollTop=el.parentElement.scrollHeight;}
function setPanel(name){window.dispatchEvent(new Event('scl-open-panel'));activePanel=name;$$('[data-panel]').forEach(b=>{b.classList.toggle('active',b.dataset.panel===name);b.setAttribute('aria-selected',String(b.dataset.panel===name));});for(const n of ['io','trace','console'])$('#'+n+'Panel').classList.toggle('hidden',n!==name);if(name==='trace')drawTrace();}
function inspect(name){activeInspect=name;$$('[data-inspect]').forEach(b=>b.classList.toggle('active',b.dataset.inspect===name));for(const n of ['locals','watches','globals'])$('#'+n+'View').classList.toggle('hidden',n!==name);renderInspector();}
function serialize(){return {version:3,currentExample,filename,code:code.value,drafts,projectFiles,trash,watches,breakpoints:[...breakpoints],globals:$('#globalsJson').value,dt:Number($('#dtSelect').value),speed:Number($('#speedSelect').value)};}
function currentProject(){drafts[currentExample]=code.value;projectFiles[currentExample]=filename;return serialize();}
function saveWorkspace(options={}){clearTimeout(saveTimer);try{if(storageBlocked||!projectHistory)throw Error(storageError||'Zapis lokalny niedostępny. Pobierz projekt, aby zachować pracę.');projectHistory.save(currentProject(),options);$('#saveStatus').innerHTML='<i></i> Zapisano w przeglądarce';lastSaved=Date.now();return true;}catch(error){storageError=error.message;$('#saveStatus').textContent='Niezapisane — pobierz projekt';throw error;}}
function persist(label='Edycja programu'){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{saveWorkspace({label});}catch(error){toast(error.message);}},800);}
function protectWorkspace(label){try{saveWorkspace({label,checkpoint:true});return true;}catch(error){toast(error.message+' Zmiana została wstrzymana.');return false;}}
function exportWorkspace(){download('scl-ide-projekt-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(projectHistory?projectHistory.export(currentProject()):currentProject(),null,2),'application/json');}
function restoreRevision(entry){pause(false);validateProject(entry.project);saveWorkspace({label:'Przed przywróceniem wersji '+entry.label,checkpoint:true});projectHistory.save(entry.project,{label:'Przywrócenie wersji '+entry.label});loadProject(entry.project);refreshProject();toast('Przywrócono projekt. Poprzednia praca jest w historii.');}
function refreshProject(){$('#fileName').textContent=filename;expanded.clear();renderExamples();highlight();updateTraceSelect();compileCode({quiet:true});setPanel('io');}

function sourceHash(source){let h=2166136261;for(let i=0;i<source.length;i++)h=Math.imul(h^source.charCodeAt(i),16777619);return (h>>>0).toString(16);}
function loadProject(p){
 validateProject(p);importedEntries(p);
 drafts=Object.create(null);projectFiles=Object.create(null);trash=Object.assign(Object.create(null),p.trash||{});const oldDrafts={...(p.drafts||{})};oldDrafts[p.currentExample||'custom']=p.code;
 for(const [id,source]of Object.entries(oldDrafts)){if(typeof source!=='string')continue;const legacy=legacyExamples[id];if(legacy&&sourceHash(source)===legacy.hash)continue;const target=legacy?'user_saved_'+id:id==='custom'?'user_imported':id;drafts[target]=source;projectFiles[target]=p.projectFiles?.[id]||legacy?.file||'Program.scl';}
 const activeLegacy=legacyExamples[p.currentExample];if(activeLegacy&&sourceHash(p.code)===activeLegacy.hash){currentExample='user_default';filename='MojProgram.scl';code.value=drafts.user_default??blankSource;watches=[];breakpoints=new Set();}
 else{currentExample=activeLegacy?'user_saved_'+p.currentExample:p.currentExample==='custom'?'user_imported':p.currentExample||'user_default';filename=p.filename||'Program.scl';code.value=p.code;watches=Array.isArray(p.watches)?p.watches.slice(0,20):[];breakpoints=new Set((p.breakpoints||[]).filter(Number.isInteger));}
 drafts[currentExample]=code.value;projectFiles[currentExample]=filename;$('#globalsJson').value=p.globals||'{}';
 for(const [id,key]of [['dtSelect','dt'],['speedSelect','speed']])if(p[key]!==undefined)$('#'+id).value=String(p[key]);
}
function restore(){try{projectHistory=new ProjectHistory(localStorage);const p=projectHistory.current()||JSON.parse(localStorage.getItem('scl-lab-project-v3')||localStorage.getItem('scl-lab-project-v2')||localStorage.getItem('scl-lab-project-v1')||'null');if(!p)return false;loadProject(p);return true;}catch(error){storageBlocked=true;storageError='Nie można odczytać zapisu. Dane nie zostały nadpisane. '+error.message;return false;}}

function highlight(){const text=code.value;let result='',last=0,sourceLine=1;const visible=editorFolding?new Set(editorFolding.rows.map(r=>r.line)):null;const emit=(chunk,cls)=>{const pieces=chunk.split('\n');for(let i=0;i<pieces.length;i++){if(!visible||visible.has(sourceLine))result+=cls?'<span class="tok-'+cls+'">'+esc(pieces[i])+'</span>':esc(pieces[i]);if(i<pieces.length-1){if(!visible||visible.has(sourceLine))result+='\n';sourceLine++;}}};const re=/(\/\*[\s\S]*?\*\/|\(\*[\s\S]*?\*\)|\/\/[^\n]*|"(?:[^"]|"")*"|'(?:[^']|'')*'|\b(?:LTIME|TIME|LT|T)#[+-]?(?:\d+(?:\.\d+)?(?:ms|us|ns|d|h|m|s))+|#[\w\u00c0-\u024f]+|\b[A-Za-z_][\w]*\b|\b\d+(?:\.\d+)?)/gi;
 const kw=new Set(languageKeywords),types=new Set(supportedTypes);
 for(const m of text.matchAll(re)){emit(text.slice(last,m.index));let t=m[0],cls=t.startsWith('//')||t.startsWith('/*')||t.startsWith('(*')?'comment':t[0]==='"'||t[0]==="'"?'string':t[0]==='#'?'local':/^(LTIME|TIME|LT|T)#/i.test(t)?'time':/^\d/.test(t)?'number':kw.has(t.toUpperCase())?'keyword':types.has(t.toUpperCase())?'type':null;emit(t,/^\/\/\s*@debug\b/i.test(t)?'debug-directive':cls);last=m.index+t.length;}emit(text.slice(last));$('#highlight').innerHTML=result+'\n';renderGutter();syncScroll();cursor();}
function renderGutter(){const rows=editorFolding?.rows||code.value.split('\n').map((text,i)=>({line:i+1,text}));const active=errorLine||machine?.nextLine||machine?.lastLine;$('#gutter').innerHTML='<div class="gutter-inner">'+rows.map(row=>{const n=row.line,r=editorFolding?.rangeAt(n),collapsed=r&&editorFolding.collapsed.has(r.key),insideBreak=r&&[...breakpoints].some(b=>b>r.start&&b<=r.end);return `<div class="gutter-row"><button class="gutter-line ${breakpoints.has(n)?'break':''} ${n===active?(errorLine?'error':'current'):''}" data-line="${n}" title="${n===machine?.nextLine?'Następna instrukcja — jeszcze niewykonana. ':''}${breakpoints.has(n)?'Usuń':'Dodaj'} punkt przerwania w linii ${n}" aria-label="Linia ${n}${breakpoints.has(n)?', punkt przerwania':''}">${n}</button>${r?`<button class="fold-toggle ${collapsed?'collapsed':''} ${collapsed&&insideBreak?'fold-breakpoint':''}" data-fold="${n}" aria-expanded="${!collapsed}" aria-label="${collapsed?'Rozwiń':'Zwiń'} ${r.kind} w linii ${n}" title="${collapsed?'Rozwiń':'Zwiń'} ${r.kind} · linie ${r.start}–${r.end}${insideBreak?' · breakpoint wewnątrz':''}">${collapsed?'▸':'▾'}</button>`:'<span class="fold-spacer"></span>'}</div>`;}).join('')+'</div>';$('#breakpointCount').textContent=breakpoints.size+' '+(breakpoints.size===1?'punkt przerwania':'punktów przerwania');syncScroll();}
function editorLineHeight(){return parseFloat(getComputedStyle(code).lineHeight)||24;}
function syncScroll(){runtimeMonitor?.render(machine,{running,dirty,error:!!errorLine});const h=$('#highlight');h.scrollTop=code.scrollTop;h.scrollLeft=code.scrollLeft;const g=$('.gutter-inner');if(g)g.style.transform=`translateY(${-code.scrollTop}px)`;const line=errorLine||machine?.nextLine||machine?.lastLine;const viewRow=editorFolding?editorFolding.rowForLine(line):line-1;editorFolding?.render();const el=$('#executionHighlight');if(line&&viewRow!==null){el.style.display='block';el.style.top=(viewRow*editorLineHeight()-code.scrollTop)+'px';el.classList.toggle('error',!!errorLine);}else el.style.display='none';}
function goLine(line){editorFolding?.revealLine(line);const lines=code.value.split('\n'),pos=lines.slice(0,line-1).reduce((n,s)=>n+s.length+1,0);code.focus();code.setSelectionRange(pos,pos);code.scrollTop=Math.max(0,(editorFolding?.rowForLine(line)??line-1)*editorLineHeight()-code.clientHeight*.35);syncScroll();cursor();}
function cursor(){const before=code.value.slice(0,code.selectionStart).split('\n');$('#cursorStatus').textContent='Ln '+before.length+', Kol '+(before.at(-1).length+1);}
function markDirty(){debugPromptLog=null;$('#debugInputForm').hidden=true;pause(false);dirty=true;errorLine=null;$('#dirtyMark').textContent='•';$('#compileStatus').innerHTML='<i style="background:#e4bd78"></i> Kod zmieniony';drafts[currentExample]=code.value;persist();highlight();renderStatus();}
function workspaceTypeSources(){return Object.entries(drafts).filter(([id])=>id!==currentExample).map(([id,source])=>({id,name:projectFiles[id]||'Program.scl',source}));}
function executeDebugDirective(token, runtime) {
 if (!$('#enableDebugDirectives').checked) return;
 const report = message => log(`[DEBUG · cykl ${runtime.scans + 1}] ${message}`, 'info', token.line);
 const [, command, args=''] = /^\/\/\s*@debug(?:\s+(\w+))?\s*(.*)$/i.exec(token.text.trim()) ?? [];
 const readMessage = value => {
  const message = JSON.parse(value);
  if (typeof message !== 'string') throw new Error('Oczekiwano tekstu w cudzysłowie.');
  return message;
 };
 try {
  switch (command?.toLowerCase()) {
   case 'log': report(readMessage(args)); break;
   case 'print': {
    const paths = args.split(/,(?![^\[]*\])/).map(path => path.trim());
    report(paths.map(path => {
     const {v,t} = runtime.read(path);
     return path + ' = ' + formatValue(v,t);
    }).join(' · '));
    break;
   }
   case 'input': {
    const parts = /^(.+?)\s+("(?:[^"\\]|\\.)*")$/.exec(args);
    if (!parts) throw new Error('Użyj input #Zmienna "Pytanie".');
    const [, path, message] = parts;
    const {v,t} = runtime.read(path);
    if (typeof v === 'object') throw new Error('Podaj pojedyncze pole lub element tablicy.');
    const prompt = readMessage(message);
    setPanel('console');
    debugPromptLog = report(prompt + ' (' + path + ', ' + t + ')');
    const form = $('#debugInputForm'), field = $('#debugInputValue');
    runtime.debugWaiting = true;
    pause(false);
    $('#debugInputLabel').textContent = prompt + ' [' + t + ']';
    $('#debugInputError').textContent = '';
    field.value = formatValue(v,t);
    form.hidden = false;
    renderLogs();
    field.focus();
    field.select();
    const resume = () => {
     form.hidden = true;
     debugPromptLog = null;
     runtime.debugWaiting = false;
     if (machine !== runtime || dirty) return;
     renderAll();
    };
    form.onsubmit = event => {
     event.preventDefault();
     try {
      const raw = field.value;
      let value = raw;
      if (typeof v === 'boolean') {
       if (!/^(TRUE|FALSE|0|1)$/i.test(raw.trim())) throw new Error('Wpisz TRUE, FALSE, 1 lub 0.');
       value = /^(TRUE|1)$/i.test(raw.trim());
      } else if (typeof v === 'number' && !['TIME','LTIME'].includes(t)) {
       value = Number(raw.trim().replace(',', '.'));
       if (!raw.trim() || !Number.isFinite(value)) throw new Error('Wpisz liczbę.');
      }
      runtime.write(path,value);
      report(path + ' = ' + formatValue(runtime.read(path).v,t));
     } catch (error) {
      $('#debugInputError').textContent = error.message;
      field.focus();
      return;
     }
     resume();
    };
    $('#debugInputCancel').onclick = () => {
     report('Anulowano. Zachowano dotychczasową wartość.');
     resume();
    };
    break;
   }
   default: throw new Error('Dostępne polecenia: log, print, input.');
  }
 } catch (error) { report(error.message); }
}
function compileCode({quiet=false}={}){debugPromptLog=null;$('#debugInputForm').hidden=true;pause(false);try{const extra=globalsFromJSON($('#globalsJson').value);const globals=Object.create(null);Object.assign(globals,extra);machine=compile(code.value,{globals,debugDirectives:true,onDebug:executeDebugDirective,typeSources:workspaceTypeSources(),dt:Number($('#dtSelect').value)});machine.onScan=()=>{const values={};for(const w of watches){try{const v=machine.read(w).v;if(typeof v==='boolean'||typeof v==='number')values[w]=Number(v);}catch{}}history.push({time:machine.now,values});if(history.length>160)history.shift();};history=[];dirty=false;errorLine=null;skipBreakpoint=null;$('#dirtyMark').textContent='';$('#compileStatus').innerHTML='<i></i> Składnia i nazwy OK';if(!quiet)log('Sprawdzono '+machine.program.name+'. Pamięć instancji wyzerowana.');renderAll();persist();return true;}catch(e){handleError(e);return false;}}
function handleError(e){pause(false);if(e.sourceId&&Object.hasOwn(drafts,e.sourceId)&&e.sourceId!==currentExample){drafts[currentExample]=code.value;projectFiles[currentExample]=filename;currentExample=e.sourceId;filename=projectFiles[currentExample]||'Program.scl';code.value=drafts[currentExample];$('#fileName').textContent=filename;machine=null;dirty=true;watches=[];breakpoints.clear();expanded.clear();highlight();renderExamples();updateTraceSelect();persist();}errorLine=e.line||1;$('#compileStatus').innerHTML='<i style="background:#ed817e"></i> Błąd · '+errorLine+':'+(e.col||1);log((e.sourceName?e.sourceName+': ':'')+e.message+' (kolumna '+(e.col||1)+')','error',errorLine);renderStatus();renderGutter();setPanel('console');goLine(errorLine);if(e.range){code.setSelectionRange(e.range.start,e.range.end);cursor();}toast('Linia '+errorLine+', kolumna '+(e.col||1)+': '+e.message);}
function ensure(){if((dirty||!machine||errorLine)&&!compileCode())return false;if(machine.debugWaiting){setPanel('console');$('#debugInputValue').focus();return false;}if(machine.program.definitionOnly){toast('To plik definicji UDT. Otwórz program FB, FC lub OB, aby uruchomić symulację.');return false;}return true;}
function pause(announce=true){const was=running;running=false;if(was&&machine?.nextLine)editorFolding?.revealLine(machine.nextLine);clearInterval(interval);interval=null;if(was&&announce)log('Pauza. Pamięć i czas symulacji zachowane.');if(was)renderAll();else renderStatus();}
function run(){if(running){pause();return;}if(!ensure()||!flushEditedValues())return;running=true;skipBreakpoint=machine.nextLine;log('Uruchomiono cykliczne wykonanie. Cykl: '+machine.dt+' ms.');restartInterval();renderStatus();}
function restartInterval(){clearInterval(interval);if(!running)return;const dt=machine.dt,speed=Number($('#speedSelect').value),period=Math.max(16,dt/speed),scansPerTick=Math.max(1,Math.round(period*speed/dt));interval=setInterval(()=>{try{const deadline=performance.now()+8;let steps=0;for(let s=0;s<scansPerTick&&running;s++){const initial=machine.scans;while(machine.scans===initial&&running){if(!machine.generator)machine.beginScan();if(machine.scans!==initial)break;const line=machine.nextLine;if(breakpoints.has(line)&&skipBreakpoint!==line){pause(false);log('Punkt przerwania w linii '+line+'.','info',line);goLine(line);renderAll();return;}skipBreakpoint=null;machine.step();if(++steps>=12000||performance.now()>=deadline)break;}if(steps>=12000||performance.now()>=deadline)break;}if(Date.now()-renderTick>75){renderAll();renderTick=Date.now();}}catch(e){handleError(e);}},period);}
function stepInstruction(){pause(false);if(!ensure()||!flushEditedValues())return;try{machine.step();errorLine=null;renderAll();if(machine.nextLine)goLine(machine.nextLine);}catch(e){handleError(e);}}
function stepScan(){pause(false);if(!ensure()||!flushEditedValues())return;try{machine.scan();errorLine=null;renderAll();}catch(e){handleError(e);}}
function renderStatus(){runtimeMonitor?.render(machine,{running,dirty,error:!!errorLine});const waiting=!!machine?.debugWaiting&&!dirty;
const state=waiting?'Oczekuje na wartość · po odpowiedzi pozostanie w pauzie':errorLine?'Błąd':dirty?'Kod zmieniony':running?'Wykonywanie cykliczne':machine?.nextLine?'Pauza · następna linia '+machine.nextLine:'Zatrzymany';$('#executionStatus').textContent=state;$('#executionDot').className='status-dot'+(running?' running':errorLine?' error':'');const runSelected=running;$('#runIcon').textContent=runSelected?'Ⅱ':'▶';$('#runLabel').textContent=runSelected?'Pauza':'Uruchom';$('#livePill').innerHTML='<i></i> '+(waiting?'INPUT':running?'RUN':errorLine?'BŁĄD':'PAUZA');$('#livePill').classList.toggle('running',running);$('#scanMetric').textContent=(machine?.scans||0).toLocaleString('pl');const time=machine?.now||0;$('#timeMetric').innerHTML=time>=1000?(time/1000).toFixed(2)+'<span> s</span>':time+'<span> ms</span>';}
function formatValue(v,t){if(typeof v==='object')return '…';if(t==='TIME'||t==='LTIME')return 'T#'+v+'ms';if(typeof v==='boolean')return v?'TRUE':'FALSE';return String(v);}
function valueControl(path,type,value){const kind=type.name||type.kind;if(type.kind!=='scalar')return `<button class="expand-button" data-expand="${esc(path)}">${expanded.has(path)?'▾':'▸'}</button>`;if(kind==='BOOL')return `<button class="bool-toggle ${value?'on':''}" data-toggle="${esc(path)}" aria-label="Przełącz ${esc(path)}">${value?'TRUE':'FALSE'}</button>`;return `<input class="value-input" aria-label="Wartość ${esc(path)}" data-value="${esc(path)}" data-type="${esc(kind)}" value="${esc(formatValue(value,kind))}" title="Enter zatwierdza, Escape anuluje">`;}
function renderRow(name,type,value,path,depth=0){let children='';if(expanded.has(path)&&depth<4){if(type.kind==='struct'){children=type.fields.map(f=>renderRow(f.name,f.type,value[f.name],path+'.'+f.name,depth+1)).join('');}else if(type.kind==='timer'){children=['IN','PT','Q','ET',...(type.name.includes('TRIG')?['CLK']:[])].map(f=>renderRow(f,{kind:'scalar',name:['IN','Q','CLK'].includes(f)?'BOOL':'TIME'},value[f],path+'.'+f,depth+1)).join('');}else if(type.kind==='array'){const rec=(dims,v,prefix)=>{const[lo,hi]=dims[0];const max=Math.min(hi,lo+11);let out='';for(let i=lo;i<=max;i++){if(dims.length===1){const ix=[...prefix,i];out+=renderRow('['+ix.join(',')+']',type.of,v[i],path+'['+ix.join(',')+']',depth+1);}else out+=rec(dims.slice(1),v[i],[...prefix,i]);}if(hi>max)out+='<div class="array-note">Dalsze elementy dodaj do obserwowanych.</div>';return out;};children=rec(type.dims,value,[]);}}
 const typeLabel=type.udtName|| (type.kind==='array'?'ARRAY ['+type.dims.map(d=>d.join('..')).join(',')+']':type.name||'STRUCT');return `<div class="var-row"><div class="var-left" ${type.kind!=='scalar'?`data-expand="${esc(path)}"`:''} title="${esc(path)}"><span class="var-name">${esc(name)}</span><div class="var-type">${esc(typeLabel)}</div></div><div class="var-value"><button class="watch-add" data-watch="${esc(path)}" title="Dodaj do obserwowanych" aria-label="Obserwuj ${esc(path)}">＋</button>${valueControl(path,type,value)}</div></div>${children?'<div class="nested">'+children+'</div>':''}`;
}
function renderInspector(){if(!machine)return;if(activeInspect==='locals'&&machine.program.definitionOnly){$('#variables').innerHTML='<div class="empty-inspector">Typy UDT: '+Object.keys(machine.program.types).map(esc).join(', ')+'.<br>Otwórz FB, FC lub OB, aby ustawić zmienne i uruchomić symulację.</div>';return;}if(activeInspect==='locals'){const filter=$('#variableFilter').value.toLowerCase();let html='';for(const [section,label]of [['VAR_INPUT','WEJŚCIA'],['VAR_OUTPUT','WYJŚCIA'],['VAR_IN_OUT','IN_OUT · LOKALNA KOPIA'],['VAR','PAMIĘĆ STATYCZNA'],['VAR_STAT','PAMIĘĆ STATYCZNA'],['VAR_TEMP','TYMCZASOWE'],['VAR_CONSTANT','STAŁE']]){const names=Object.keys(machine.locals).filter(n=>machine.sections[n]===section&&n.toLowerCase().includes(filter));if(names.length){html+='<div class="var-group-label">'+label+'</div>';html+=names.map(n=>renderRow(n,machine.schemas[n],machine.locals[n],'#'+n)).join('');}}renderLiveControls($('#variables'),html||'<div class="empty-inspector">Brak zmiennych. Dodaj deklaracje VAR do programu.</div>');}
 if(activeInspect==='watches'){renderLiveControls($('#watches'),watches.map(w=>{try{const r=machine.resolve(machine.ref(w)),v=r.obj[r.key];return `<div class="watch-item"><div class="watch-top"><span class="watch-path">${esc(w)}</span><button class="remove-watch" data-remove="${esc(w)}" aria-label="Usuń ${esc(w)}">×</button></div><div class="watch-bottom"><span class="var-type">${esc(r.type.name||r.type.kind)}</span>${valueControl(w,r.type,v)}</div></div>`;}catch(e){return `<div class="watch-item"><div class="watch-top"><span class="watch-path">${esc(w)}</span><button class="remove-watch" data-remove="${esc(w)}">×</button></div><span class="watch-error">${esc(e.message)}</span></div>`;}}).join('')||'<div class="empty-inspector">Dodaj sygnał, który chcesz śledzić.</div>');}
 $('#watchCount').textContent=watches.length;
}
function addWatch(w){if(!machine&&!ensure())return;try{machine.read(w);if(!watches.includes(w)){watches.push(w);if(watches.length>20)watches.shift();log('Dodano obserwację: '+w);persist();}inspect('watches');updateTraceSelect();}catch(e){toast(e.message);}}
function updateTraceSelect(){const select=$('#traceSelect'),old=select.value;select.innerHTML=watches.map(w=>`<option value="${esc(w)}">${esc(w)}</option>`).join('');if(watches.includes(old))select.value=old;select.disabled=watches.length===0;if(select.disabled)select.add(new Option('Brak obserwowanych sygnałów',''));}

function drawTrace(){if(activePanel!=='trace')return;const c=$('#traceCanvas'),key=$('#traceSelect').value;
const data=history.filter(p=>Object.hasOwn(p.values,key));
const empty=$('#traceEmpty');
const hasSamples=data.length>1;
empty.classList.toggle('hidden',hasSamples);
c.classList.toggle('hidden',!hasSamples);
if(!hasSamples){
  empty.textContent=key?'Wykonaj co najmniej dwa cykle PLC, aby zobaczyć przebieg.':'Dodaj zmienną do obserwowanych, aby rozpocząć pomiar.';
  return;
}
const palette=getComputedStyle(c);
const ctx=c.getContext('2d'),rect=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;c.width=Math.max(1,rect.width*dpr);c.height=165*dpr;ctx.scale(dpr,dpr);const width=rect.width,height=165;ctx.clearRect(0,0,width,height);ctx.font='8px Consolas,monospace';ctx.fillStyle=palette.color;const vals=data.map(p=>p.values[key]);let lo=Math.min(0,...vals),hi=Math.max(1,...vals);if(lo===hi)hi=lo+1;let left=40,right=width-14,top=10,bottom=135;ctx.lineWidth=1;for(let i=0;i<4;i++){let y=top+(bottom-top)*i/3;ctx.strokeStyle=palette.getPropertyValue('--trace-grid').trim();ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();let label=hi-(hi-lo)*i/3;ctx.fillText(label.toFixed(hi-lo>10?0:1),2,y+3);}const x=i=>left+(right-left)*i/(data.length-1),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);ctx.beginPath();ctx.moveTo(x(0),bottom);ctx.lineTo(x(0),y(vals[0]));for(let i=1;i<data.length;i++){ctx.lineTo(x(i),y(vals[i-1]));ctx.lineTo(x(i),y(vals[i]));}ctx.lineTo(right,bottom);ctx.closePath();ctx.fillStyle='#2ba48512';ctx.fill();ctx.beginPath();ctx.moveTo(x(0),y(vals[0]));for(let i=1;i<data.length;i++){ctx.lineTo(x(i),y(vals[i-1]));ctx.lineTo(x(i),y(vals[i]));}ctx.strokeStyle='#34977c';ctx.lineWidth=1.6;ctx.stroke();ctx.fillStyle=palette.color;ctx.fillText((data[0].time/1000).toFixed(2)+' s',left,156);ctx.textAlign='right';ctx.fillText((data.at(-1).time/1000).toFixed(2)+' s',right,156);ctx.textAlign='left';}
function renderAll(){const definitionOnly=!!machine?.program.definitionOnly;for(const id of ['runBtn','stepBtn','scanBtn','addVariableBtn','addIOBtn'])$('#'+id).disabled=definitionOnly;renderStatus();renderInspector();renderIO();renderGutter();drawTrace();}
function renderExamples(){renderUserProjects();}
function download(name,data,type='text/plain'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function editValue(path,value){if(!machine)return;try{machine.write(path,value);renderAll();}catch(e){toast(e.message);renderAll();}}

function renderIO(){if(!machine)return;if(machine.program.definitionOnly){$('#ioCounts').textContent=Object.keys(machine.program.types).length+' typów UDT · definicje projektu';$('#ioLimit').textContent='';$('#ioInputs').innerHTML='<div class="io-empty">Ten plik definiuje typy danych. Użyj ich nazw w deklaracjach zmiennych programu.</div>';$('#ioOutputs').innerHTML='<div class="io-empty">Otwórz FB, FC lub OB, aby uruchomić symulację.</div>';return;}const io=ioSignals(machine);$('#ioCounts').textContent=io.inputs.length+' wejść · '+io.outputs.length+' wyjść · z Twoich deklaracji';$('#ioLimit').textContent=io.truncated?'Podgląd do 80 sygnałów':'';
 const renderSignal=(s,input)=>{let control;if(input){control=valueControl(s.path,s.type,s.value);if(s.type.name==='BOOL')control+=`<button class="io-pulse" data-pulse="${esc(s.path)}" aria-label="Impuls na jeden cykl ${esc(s.path)}" title="TRUE przez jeden pełny cykl PLC">1 cykl ↥</button>`;}else if(s.type.name==='BOOL')control=`<span class="io-light ${s.value?'on':''}" aria-label="Wyjście ${esc(s.name)}: ${s.value?'TRUE':'FALSE'}"><i></i>${s.value?'TRUE':'FALSE'}</span>`;else control=`<output class="io-output-value" aria-label="Wyjście ${esc(s.name)}">${esc(formatValue(s.value,s.type.name))}</output>`;
 return `<div class="io-signal"><div class="io-signal-name"><strong title="${esc(s.path)}">${esc(s.name)}</strong><small>${esc(s.type.name)}</small></div><div class="io-signal-controls">${control}</div></div>`;};
 renderLiveControls($('#ioInputs'),io.inputs.map(s=>renderSignal(s,true)).join('')||'<div class="io-empty">Dodaj własne wejście w sekcji VAR_INPUT.<button data-add-section="VAR_INPUT">＋ Dodaj wejście</button></div>');
 renderLiveControls($('#ioOutputs'),io.outputs.map(s=>renderSignal(s,false)).join('')||'<div class="io-empty">Zadeklaruj wyjście w VAR_OUTPUT, aby obserwować wynik.<button data-add-section="VAR_OUTPUT">＋ Dodaj wyjście</button></div>');
}
function decodeInputValue(input){const type=input.dataset.type;let value=input.value.trim();if(type==='TIME'||type==='LTIME'){const p=new Parser(value);value=machine.eval(p.expression()).v;p.need('EOF');}else if(!['STRING','CHAR'].includes(type)){value=Number(value);if(input.value.trim()===''||!Number.isFinite(value))throw new Error('Wpisz poprawną liczbę.');}return value;}
const valueEditor=createValueEditor({decode:decodeInputValue,write:(input,value)=>machine.write(input.dataset.value,value),render:renderAll,report:toast});
function flushEditedValues(){return !machine||valueEditor.flush($$('[data-value]'));}
function commitValueInput(input){if(machine)return valueEditor.commit(input);}
function pulseInput(path){if(!ensure()||!flushEditedValues())return;try{if(machine.generator)machine.scan();if(machine.debugWaiting)return;const value=machine.read(path).v;if(value===true){toast('Najpierw ustaw wejście na FALSE, aby podać impuls.');return;}machine.write(path,true);const runtime=machine;
const onScan=runtime.onScan;
runtime.onScan=()=>{runtime.onScan=onScan;onScan?.();runtime.write(path,false);};
runtime.scan();renderAll();log('Impuls '+path+': TRUE przez jeden cykl PLC.');}catch(er){handleError(er);}}
function openVariable(section='VAR_INPUT'){pause(false);$('#declSection').value=section;$('#declName').value='';$('#declError').textContent='';$('#declArray').checked=false;updateDeclarationPreview();$('#variableDialog').showModal();$('#declName').focus();}
function updateDeclarationPreview(){const array=$('#declArray').checked,type=$('#declType').value,timer=type.endsWith('_TIME')||type.endsWith('_TRIG');$('#arrayBounds').classList.toggle('hidden',!array);$('#declInitial').disabled=array||timer;const name=$('#declName').value.trim()||'NowaZmienna';const spec=array?'Array['+$('#declLower').value+'..'+$('#declUpper').value+'] of '+type:type;const initial=!array&&!timer&&$('#declInitial').value.trim()?' := '+$('#declInitial').value.trim():'';$('#declPreview').textContent=name+' : '+spec+initial+';';$('#declError').textContent='';}
function renderUserProjects(){const ids=Object.keys(drafts);$('#userProjects').innerHTML='<div class="section-label">MOJE PROGRAMY <span>'+ids.length+'</span></div>'+ids.map(id=>`<div class="project-row"><button class="user-project-button ${currentExample===id?'active':''}" data-project="${esc(id)}" title="${esc(projectFiles[id]||'Program.scl')}">S · ${esc(projectFiles[id]||'Program.scl')}</button><button class="delete-project" data-delete-project="${esc(id)}" aria-label="Usuń ${esc(projectFiles[id]||'Program.scl')}" title="Przenieś do kosza">×</button></div>`).join('')+'<div class="trash-toolbar"><div class="trash-heading">KOSZ · '+Object.keys(trash).length+'</div><button class="empty-trash-button" data-empty-trash '+(Object.keys(trash).length?'':'disabled')+' title="Opróżnij kosz z kopią w historii">Opróżnij kosz</button></div>'+Object.entries(trash).map(([id,p])=>`<div class="project-row"><span class="trashed-name">${esc(p.filename)}</span><button class="restore-project" data-restore-project="${esc(id)}" title="Przywróć program" aria-label="Przywróć ${esc(p.filename)}">↶</button></div>`).join('');}
function deleteProgram(id){pause(false);if(!protectWorkspace('Przed usunięciem programu'))return;if(id===currentExample)drafts[id]=code.value;if(!Object.hasOwn(drafts,id))return;const item={code:drafts[id],filename:projectFiles[id]||'Program.scl'};trash[id]=item;delete drafts[id];delete projectFiles[id];if(id===currentExample){const next=Object.keys(drafts)[0];if(next){currentExample=next;filename=projectFiles[next]||'Program.scl';code.value=drafts[next];}else{currentExample='user_'+revisionId();filename='MojProgram.scl';code.value=blankSource;drafts[currentExample]=code.value;projectFiles[currentExample]=filename;}watches=[];breakpoints.clear();$('#fileName').textContent=filename;highlight();updateTraceSelect();compileCode({quiet:true});}else{markDirty();}renderUserProjects();persist();toast('Program przeniesiony do kosza. Możesz go przywrócić.');}
function restoreProgram(id){pause(false);if(!protectWorkspace('Przed przywróceniem z kosza'))return;const item=trash[id];if(!item)return;let target=Object.hasOwn(drafts,id)?'user_'+revisionId():id;drafts[target]=item.code;projectFiles[target]=item.filename;delete trash[id];markDirty();renderUserProjects();persist();toast('Przywrócono '+item.filename);}

function openEmptyTrash(){pause(false);const count=Object.keys(trash).length;if(!count)return;$('#emptyTrashCount').textContent=String(count);$('#emptyTrashError').textContent='';$('#emptyTrashDialog').showModal();}
function emptyTrash(){try{if(storageBlocked||!projectHistory)throw Error(storageError||'Zapis jest niedostępny. Pobierz projekt.');const next=projectHistory.emptyTrash(currentProject());trash=Object.assign(Object.create(null),next.trash);clearTimeout(saveTimer);renderUserProjects();$('#saveStatus').innerHTML='<i></i> Zapisano w przeglądarce';$('#emptyTrashDialog').close();toast('Kosz opróżniony. Kopia projektu jest w Historii.');}catch(error){$('#emptyTrashError').textContent='Nie opróżniono kosza. '+error.message;}}
async function loadTestProgram(){const button=$('#testCodeBtn');button.disabled=true;try{const response=await fetch('./FB_TestSCL.scl');if(!response.ok)throw Error('Nie można pobrać programu testowego.');const source=await response.text();pause(false);if(storageBlocked||!projectHistory)throw Error(storageError||'Zapis jest niedostępny. Pobierz projekt.');const next=withTestProgram(currentProject(),source);projectHistory.save(next,{label:'Dodanie programu testowego'});loadProject(next);refreshProject();inspect('locals');toast('Kod testowy: podaj impuls Start i obserwuj Krok oraz wyniki.');}catch(error){toast(error.message);}finally{button.disabled=false;}}

function formatEditor(announce=true){if(running)pause(false);const focused=document.activeElement===code;const old=code.value,next=formatSCL(old);if(next!==old){if(!protectWorkspace('Przed formatowaniem'))return;const line=old.slice(0,code.selectionStart).split('\n').length;code.value=next;markDirty();if(focused)goLine(line);}if(announce)toast('Wyrównano wcięcia kodu.');}

function newProgram(kind='program'){let udtIndex=1;const usedTypes=new Set(Object.values(drafts).flatMap(source=>[...source.matchAll(/\bTYPE\s+"?UDT_(\d+)"?/gi)].map(m=>Number(m[1]))));while(usedTypes.has(udtIndex))udtIndex++;pause(false);drafts[currentExample]=code.value;projectFiles[currentExample]=filename;currentExample='user_'+revisionId();filename='Program_'+(Object.keys(drafts).filter(id=>id.startsWith('user_')).length+1)+'.scl';projectFiles[currentExample]=filename;code.value=kind==='udt'?'TYPE \"UDT_'+udtIndex+'\"\nVERSION : 1.0\nSTRUCT\n    Wartosc : REAL;\nEND_STRUCT;\nEND_TYPE':blankSource;if(kind==='udt'){filename='UDT_'+udtIndex+'.scl';projectFiles[currentExample]=filename;}drafts[currentExample]=code.value;watches=[];breakpoints.clear();expanded.clear();$('#fileName').textContent=filename;code.setSelectionRange(0,0);code.scrollTop=0;renderExamples();highlight();updateTraceSelect();compileCode();inspect('locals');setPanel('io');persist();toast(kind==='udt'?'Nowy typ UDT — wklej definicję z TIA Portal lub uzupełnij pola.':'Nowy program — dodaj zmienne i napisz kod.');}
function openUserProject(id){pause(false);drafts[currentExample]=code.value;projectFiles[currentExample]=filename;currentExample=id;filename=projectFiles[id]||'Program.scl';code.value=drafts[id]??blankSource;watches=[];breakpoints.clear();expanded.clear();$('#fileName').textContent=filename;code.setSelectionRange(0,0);code.scrollTop=0;renderExamples();highlight();updateTraceSelect();compileCode();inspect('locals');setPanel('io');persist();}

function wire(){
 setupAssist(code);
 setupHistoryPanel({getProject:currentProject,getEntries:()=>projectHistory?.entries()||[],saveCurrent:()=>{pause(false);saveWorkspace();},checkpoint:label=>saveWorkspace({label,checkpoint:true,kind:'manual'}),restore:restoreRevision,exportProject:exportWorkspace,exportRaw:()=>{const raw=localStorage.getItem(HISTORY_KEY)||localStorage.getItem('scl-lab-project-v3')||localStorage.getItem('scl-lab-project-v2')||localStorage.getItem('scl-lab-project-v1');if(!raw)throw Error('Brak danych do pobrania.');download('scl-ide-dane-odzyskiwania.txt',raw);}});
 runtimeMonitor=setupInlineMonitor(code,addWatch);
 $('#foldAllBtn').onclick=()=>editorFolding.foldAll();$('#unfoldAllBtn').onclick=()=>editorFolding.unfoldAll();$('#formatBtn').onclick=()=>formatEditor();
 try{$('#autoFormat').checked=localStorage.getItem('scl-auto-format')==='true';}catch{}
 $('#autoFormat').onchange=()=>{try{localStorage.setItem('scl-auto-format',String($('#autoFormat').checked));}catch{}};
 $('#functionsBtn').onclick=()=>{$('#functionList').textContent=supportedFunctions.join(' · ');$('#functionsDialog').showModal();};$('#closeFunctions').onclick=()=>$('#functionsDialog').close();
 code.addEventListener('keydown',e=>{if(e.shiftKey&&e.altKey&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopImmediatePropagation();formatEditor();}},true);
 code.addEventListener('blur',()=>{if($('#autoFormat').checked)formatEditor(false);});
 code.addEventListener('paste',()=>{setTimeout(()=>{if($('#autoFormat').checked)formatEditor(false);},0);});

 code.addEventListener('input',markDirty);code.addEventListener('scroll',syncScroll);code.addEventListener('click',cursor);code.addEventListener('keyup',cursor);code.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const start=code.selectionStart,end=code.selectionEnd;code.setRangeText('    ',start,end,'end');markDirty();}if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();let before=code.value.slice(0,code.selectionStart),indent=before.split('\n').at(-1).match(/^\s*/)[0];code.setRangeText('\n'+indent,code.selectionStart,code.selectionEnd,'end');markDirty();}});
 $('#gutter').addEventListener('mousedown',e=>{if(e.target.closest('[data-fold]'))e.preventDefault();});
 $('#gutter').addEventListener('click',e=>{const fold=e.target.closest('[data-fold]');if(fold){editorFolding.toggle(Number(fold.dataset.fold));return;}let b=e.target.closest('[data-line]');if(!b)return;let n=Number(b.dataset.line);if(breakpoints.has(n))breakpoints.delete(n);else breakpoints.add(n);renderGutter();persist();});
 $('#runBtn').onclick=run;$('#stepBtn').onclick=stepInstruction;$('#scanBtn').onclick=stepScan;$('#compileBtn').onclick=()=>compileCode();$('#resetBtn').onclick=()=>{if(compileCode({quiet:true})){log('Wyzerowano pamięć, czas symulacji.');toast('Symulator wyzerowany');}};
 $('#dtSelect').onchange=()=>{if(machine)machine.dt=Number($('#dtSelect').value);restartInterval();persist();};$('#speedSelect').onchange=()=>{restartInterval();persist();};
 $('#newBtn').onclick=()=>newProgram();$('#newUdtBtn').onclick=()=>{if(protectWorkspace('Przed dodaniem typu UDT'))newProgram('udt');};$('#testCodeBtn').onclick=loadTestProgram;$('#cancelEmptyTrash').onclick=()=>$('#emptyTrashDialog').close();$('#confirmEmptyTrash').onclick=emptyTrash;
 $$('[data-panel]').forEach(b=>b.onclick=()=>setPanel(b.dataset.panel));$$('[data-inspect]').forEach(b=>b.onclick=()=>inspect(b.dataset.inspect));$('#variableFilter').oninput=renderInspector;
 document.addEventListener('click',e=>{let b=e.target.closest('[data-toggle]');if(b){try{const v=machine.read(b.dataset.toggle).v;editValue(b.dataset.toggle,!v);}catch(er){toast(er.message);}return;}b=e.target.closest('[data-expand]');if(b){let p=b.dataset.expand;if(expanded.has(p))expanded.delete(p);else expanded.add(p);renderInspector();return;}b=e.target.closest('[data-watch]');if(b){addWatch(b.dataset.watch);return;}b=e.target.closest('[data-remove]');if(b){watches=watches.filter(w=>w!==b.dataset.remove);renderInspector();updateTraceSelect();persist();}});
 document.addEventListener('keydown',e=>{const input=e.target.closest('[data-value]');if(!input)return;if(e.key==='Escape'){e.preventDefault();valueEditor.cancel(input);}if(e.key==='Enter'){e.preventDefault();commitValueInput(input);}});
 document.addEventListener('change',e=>{const input=e.target.closest('[data-value]');if(input)commitValueInput(input);});
 $('#ioPanel').addEventListener('click',e=>{const p=e.target.closest('[data-pulse]');if(p)pulseInput(p.dataset.pulse);const add=e.target.closest('[data-add-section]');if(add)openVariable(add.dataset.addSection);});
 $('#addIOBtn').onclick=()=>openVariable('VAR_INPUT');$('#addVariableBtn').onclick=()=>openVariable('VAR_INPUT');$('#closeVariable').onclick=()=>$('#variableDialog').close();
 $('#declType').onchange=()=>{const type=$('#declType').value;$('#declInitial').value=type==='BOOL'?'FALSE':type==='TIME'?'T#0ms':type==='STRING'?"''":type.endsWith('_TIME')||type.endsWith('_TRIG')?'':type==='REAL'||type==='LREAL'?'0.0':'0';updateDeclarationPreview();};
 for(const id of ['declName','declSection','declInitial','declArray','declLower','declUpper'])$('#'+id).addEventListener('input',updateDeclarationPreview);
 $('#variableForm').onsubmit=e=>{e.preventDefault();try{if(!protectWorkspace('Przed dodaniem deklaracji'))return;const source=insertDeclaration(code.value,{name:$('#declName').value,section:$('#declSection').value,type:$('#declType').value,initial:$('#declInitial').value,array:$('#declArray').checked,lower:$('#declLower').value,upper:$('#declUpper').value},{typeSources:workspaceTypeSources()});code.value=source;drafts[currentExample]=source;highlight();$('#variableDialog').close();compileCode();inspect('locals');setPanel('io');toast('Dodano zmienną '+$('#declName').value);persist();}catch(er){$('#declError').textContent=er.message;}};
 $('#userProjects').onclick=e=>{if(e.target.closest('[data-empty-trash]')){openEmptyTrash();return;}let b=e.target.closest('[data-delete-project]');if(b){deleteProgram(b.dataset.deleteProject);return;}b=e.target.closest('[data-restore-project]');if(b){restoreProgram(b.dataset.restoreProject);return;}b=e.target.closest('[data-project]');if(b)openUserProject(b.dataset.project);};
 $('#watchForm').onsubmit=e=>{e.preventDefault();const v=$('#watchInput').value.trim();if(v){addWatch(v);$('#watchInput').value='';}};$('#applyGlobals').onclick=()=>compileCode();$('#globalsJson').oninput=()=>{dirty=true;pause(false);persist();$('#compileStatus').innerHTML='<i style="background:#e4bd78"></i> Dane DB zmienione';};

 $('#traceSelect').onchange=drawTrace;window.addEventListener('resize',drawTrace);window.addEventListener('scl-layout',()=>{syncScroll();drawTrace();});$('#clearLogs').onclick=()=>{logs=machine?.debugWaiting&&debugPromptLog?[debugPromptLog]:[];renderLogs();};$('#logs').onclick=e=>{const b=e.target.closest('[data-line]');if(b)goLine(Number(b.dataset.line));};$('#clearBreakpoints').onclick=()=>{breakpoints.clear();renderGutter();persist();toast('Usunięto punkty przerwania');};
 for(const id of ['helpBtn'])$('#'+id).onclick=()=>$('#helpDialog').showModal();$('#closeHelp').onclick=()=>$('#helpDialog').close();$('#helpDialog').onclick=e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();}};$('.brand').onclick=e=>{e.preventDefault();code.focus();};
 $('#exportBtn').onclick=()=>{if($('#autoFormat').checked)formatEditor(false);download(filename,code.value);toast('Pobrano plik SCL');};$('#downloadProject').onclick=()=>{if($('#autoFormat').checked)formatEditor(false);exportWorkspace();toast('Pobrano projekt z kodem, ustawieniami i historią');};$('#importBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw Error('Maksymalny rozmiar projektu z historią: 10 MB.');const text=await f.text();const imported=decodeImport(f.name,text);pause(false);if(!protectWorkspace('Przed importem '+f.name))return;if(imported){projectHistory.save(imported,{label:'Import projektu',imported:importedEntries(imported)});loadProject(imported);}else{currentExample='user_'+revisionId();filename=f.name;projectFiles[currentExample]=filename;code.value=text;drafts[currentExample]=text;watches=[];breakpoints.clear();}refreshProject();persist('Import pliku');toast('Wczytano '+f.name);}catch(er){toast(er.message);}finally{e.target.value='';}};
 document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(e.key==='F5'){e.preventDefault();run();}if(e.key==='F10'){e.preventDefault();if(e.shiftKey)stepScan();else stepInstruction();}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();compileCode();}if(e.key.toLowerCase()==='s'&&(e.ctrlKey||e.metaKey)){e.preventDefault();if($('#autoFormat').checked)formatEditor(false);download(filename,code.value);}});
 window.addEventListener('beforeunload',()=>{try{saveWorkspace();}catch{}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){try{saveWorkspace();}catch{}}});
 window.addEventListener('storage',e=>{if(e.key===HISTORY_KEY||e.key===null){storageBlocked=true;storageError='Projekt zmienił się w innej karcie. Pobierz swoją pracę i odśwież stronę.';clearTimeout(saveTimer);pause(false);$('#saveStatus').textContent='Zmiana w innej karcie — zapis wstrzymany';toast(storageError);}});
}
async function init(){
 editorFolding=setupCodeFolding(code,{getDocumentId:()=>currentExample,onViewChange:()=>highlight()});
 const restored=restore();if(!restored){code.value=blankSource;watches=[];drafts[currentExample]=code.value;projectFiles[currentExample]=filename;}
 $('#fileName').textContent=filename;code.setSelectionRange(0,0);code.scrollTop=0;renderExamples();highlight();wire();if(!storageBlocked&&projectHistory?.entries().length===0){try{saveWorkspace({label:'Początek historii',checkpoint:true,kind:'manual'});}catch(error){toast(error.message);}}if(storageBlocked){$('#saveStatus').textContent='Zapis wstrzymany — pobierz dane historii';toast(storageError);}updateTraceSelect();loaded=true;compileCode({quiet:true});log('SCL IDE gotowe. Napisz swój kod, ustaw wejścia i wykonaj cykl PLC.');log('Interpreter wybranego zakresu SCL. Ostateczną zgodność sprawdź w TIA Portal.','warn');window.SCLLab={get machine(){return machine;},get typeSources(){return workspaceTypeSources();},compile:compileCode,step:stepInstruction,scan:stepScan,pause};
}
init();
